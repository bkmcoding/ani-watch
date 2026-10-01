/**
 * Cloudflare Worker: HLS + poster media proxy.
 * Keeps video/poster bytes off Vercel Fast Origin Transfer.
 *
 * Routes:
 *   GET /hls?url=https://...&k=SECRET
 *   GET /poster?url=https://...&k=SECRET
 *
 * Set secret: npx wrangler secret put MEDIA_PROXY_SECRET
 * (same value as Vercel env MEDIA_PROXY_SECRET)
 */
export interface Env {
  MEDIA_PROXY_SECRET?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

/**
 * SSRF guard for stream URLs: block private/reserved ranges only.
 * We use a blocklist (not an allowlist) so CDN rotations never break playback.
 * MegaPlay/Zoko rotate CDN hostnames regularly; maintaining an allowlist
 * requires a redeployment every time they do.
 */
const BLOCKED_STREAM_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local / AWS metadata
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
  /\.local$/i,
  /\.internal$/i,
];

const POSTER_HOST_SUFFIXES = [
  'anipixcdn.co',
  'noitatnemucod.net',
  'bunnycdn.ru',
  'b-cdn.net',
  'wsrv.nl',
  'weserv.nl',
];

function isAllowedStreamHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return !BLOCKED_STREAM_HOST_PATTERNS.some((re) => re.test(host));
}

function isAllowedPosterHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (POSTER_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s))) return true;
  if (host.includes('anipix') || host.includes('noitatnemucod')) return true;
  return false;
}

function refererForStreamUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('aniwatchtv') || host.includes('zoko')) {
      return 'https://zokoanime.video/';
    }
  } catch {
    // fall through
  }
  return 'https://megaplay.buzz/';
}

function corsHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    ...extra,
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** When MEDIA_PROXY_SECRET is set, require matching `k` query param. */
function authOk(request: Request, env: Env): boolean {
  const expected = (env.MEDIA_PROXY_SECRET || '').trim();
  if (!expected) return true;
  const provided = new URL(request.url).searchParams.get('k') || '';
  return timingSafeEqual(provided, expected);
}

function buildProxyUrl(proxyBase: string, upstreamUrl: string, secret: string | null): string {
  const u = new URL(proxyBase);
  u.searchParams.set('url', upstreamUrl);
  if (secret) u.searchParams.set('k', secret);
  return u.href;
}

function stripPngWrapper(buf: Uint8Array): Uint8Array {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const marker = new TextEncoder().encode('IEND');
    let iend = -1;
    for (let i = 0; i < buf.length - 4; i++) {
      if (
        buf[i] === marker[0] &&
        buf[i + 1] === marker[1] &&
        buf[i + 2] === marker[2] &&
        buf[i + 3] === marker[3]
      ) {
        iend = i;
        break;
      }
    }
    if (iend > 0 && iend + 8 < buf.length) {
      const tail = buf.subarray(iend + 8);
      if (tail[0] === 0x47) return tail;
    }
  }
  return buf;
}

/** True when a URL looks like a subtitle file (VTT or ASS). */
function isSubtitleUrl(url: string): boolean {
  try {
    return /\.(vtt|ass|ssa)(\?|$)/i.test(new URL(url).pathname);
  } catch {
    return /\.(vtt|ass|ssa)(\?|$)/i.test(url);
  }
}

function rewritePlaylist(
  body: string,
  playlistUrl: string,
  proxyBase: string,
  vttBase: string,
  secret: string | null
): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          try {
            const abs = new URL(uri, playlistUrl).href;
            // Subtitle playlist/segment URIs go through /vtt (no auth needed);
            // everything else (video segments, key files) goes through /hls.
            if (isSubtitleUrl(abs)) {
              return `URI="${vttBase}?url=${encodeURIComponent(abs)}"`;
            }
            return `URI="${buildProxyUrl(proxyBase, abs, secret)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }
      try {
        const abs = new URL(trimmed, playlistUrl).href;
        // Plain segment lines: subtitle VTTs go through /vtt, everything else /hls
        if (isSubtitleUrl(abs)) {
          return `${vttBase}?url=${encodeURIComponent(abs)}`;
        }
        return buildProxyUrl(proxyBase, abs, secret);
      } catch {
        return line;
      }
    })
    .join('\n');
}

async function handleVtt(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return new Response('url is required', { status: 400, headers: corsHeaders() });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('url must be absolute', { status: 400, headers: corsHeaders() });
  }

  if (parsed.protocol !== 'https:') {
    return new Response('only https:// subtitle URLs are allowed', { status: 400, headers: corsHeaders() });
  }

  // CDN hosts enforce hotlink protection — send trusted Referer
  const referer = parsed.hostname.includes('aniwatchtv') || parsed.hostname.includes('zoko')
    ? 'https://zokoanime.video/'
    : 'https://megaplay.buzz/';

  const upstream = await fetch(parsed.href, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/vtt, text/plain, */*',
      Referer: referer,
      Origin: new URL(referer).origin,
    },
    redirect: 'follow',
  });

  if (!upstream.ok) {
    return new Response(`Upstream ${upstream.status}`, { status: 502, headers: corsHeaders() });
  }

  const text = await upstream.text();
  const isAss = /\.ass(\?|$)/i.test(parsed.pathname);
  const contentType = isAss ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8';

  return new Response(text, {
    status: 200,
    headers: corsHeaders({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=600',
    }),
  });
}

async function handleHls(request: Request, workerOrigin: string, env: Env): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return new Response('url is required', { status: 400, headers: corsHeaders() });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('url must be absolute', { status: 400, headers: corsHeaders() });
  }

  if (!/^https?:$/i.test(parsed.protocol) || !isAllowedStreamHost(parsed.hostname)) {
    return new Response('url host not allowed', { status: 400, headers: corsHeaders() });
  }

  const referer = refererForStreamUrl(parsed.href);
  let originHeader = 'https://megaplay.buzz';
  try {
    originHeader = new URL(referer).origin;
  } catch {
    // keep default
  }

  const upstream = await fetch(parsed.href, {
    headers: {
      'User-Agent': UA,
      Referer: referer,
      Origin: originHeader,
      Accept: '*/*',
    },
    redirect: 'follow',
  });

  if (!upstream.ok) {
    return new Response(`Upstream ${upstream.status}`, { status: 502, headers: corsHeaders() });
  }

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist =
    ct.includes('mpegurl') ||
    ct.includes('m3u8') ||
    /\.m3u8(\?|$)/i.test(parsed.pathname);

  const proxyBase = `${workerOrigin}/hls`;
  const vttBase = `${workerOrigin}/vtt`;
  const secret = (env.MEDIA_PROXY_SECRET || '').trim() || null;

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, parsed.href, proxyBase, vttBase, secret);
    return new Response(rewritten, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      }),
    });
  }

  const isVtt =
    ct.includes('text/vtt') || ct.includes('vtt') ||
    /\.vtt(\?|$)/i.test(parsed.pathname) ||
    /\.vtt(\?|$)/i.test(new URL(target).pathname);
  const isAss =
    /\.ass(\?|$)/i.test(parsed.pathname) || ct.includes('ass') ||
    /\.ass(\?|$)/i.test(new URL(target).pathname);

  if (isVtt || isAss) {
    const text = await upstream.text();
    return new Response(text, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': isAss ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      }),
    });
  }

  const ab = await upstream.arrayBuffer();
  const raw = new Uint8Array(ab);
  const isPng = raw.length > 4 && raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47;
  const media = isPng ? stripPngWrapper(raw) : raw;

  return new Response(media, {
    status: 200,
    headers: corsHeaders({
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'public, max-age=300',
    }),
  });
}

async function handlePoster(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return new Response('url is required', { status: 400, headers: corsHeaders() });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('url must be absolute', { status: 400, headers: corsHeaders() });
  }

  if (!/^https?:$/i.test(parsed.protocol) || !isAllowedPosterHost(parsed.hostname)) {
    return new Response('url host not allowed', { status: 400, headers: corsHeaders() });
  }

  const site = 'https://hianime.lu';
  const tries: Array<[string, string]> = [
    ['', ''],
    [`${site}/`, site],
    ['https://hianime.lu/', 'https://hianime.lu'],
  ];

  for (const [referer, origin] of tries) {
    try {
      const headers: Record<string, string> = {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      };
      if (referer) headers.Referer = referer;
      if (origin) headers.Origin = origin;

      const upstream = await fetch(parsed.href, {
        headers,
        redirect: 'follow',
      });
      if (!upstream.ok) continue;
      const contentType = upstream.headers.get('content-type') || '';
      if (!/^image\//i.test(contentType) && !/octet-stream/i.test(contentType)) continue;

      const type = /^image\//i.test(contentType) ? contentType : 'image/jpeg';
      return new Response(upstream.body, {
        status: 200,
        headers: corsHeaders({
          'Content-Type': type,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        }),
      });
    } catch {
      // try next referer
    }
  }

  return new Response('Upstream image unavailable', { status: 502, headers: corsHeaders() });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const workerOrigin = url.origin;
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'hianime-media-proxy',
          routes: ['/hls?url=&k=', '/vtt?url=', '/poster?url=&k='],
          auth: Boolean((env.MEDIA_PROXY_SECRET || '').trim()),
        }),
        {
          status: 200,
          headers: corsHeaders({ 'Content-Type': 'application/json' }),
        }
      );
    }

    if (path === '/hls' || path === '/poster') {
      if (!authOk(request, env)) {
        return new Response('invalid or missing media proxy key', {
          status: 401,
          headers: corsHeaders(),
        });
      }
    }

    if (path === '/hls') return handleHls(request, workerOrigin, env);
    if (path === '/vtt') return handleVtt(request);
    if (path === '/poster') return handlePoster(request);

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },
};

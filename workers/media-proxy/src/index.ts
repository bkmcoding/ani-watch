/**
 * Cloudflare Worker: HLS + poster media proxy.
 * Keeps video/poster bytes off Vercel Fast Origin Transfer.
 *
 * Routes:
 *   GET /hls?url=https://...&k=SECRET   (k required when MEDIA_PROXY_SECRET is set)
 *   GET /vtt?url=https://...           (shared CDN allowlist, no k)
 *   GET /poster?url=https://...        (shared CDN allowlist, no k)
 *
 * Set secret: npx wrangler secret put MEDIA_PROXY_SECRET
 * (same value as Vercel env MEDIA_PROXY_SECRET)
 *
 * The SSRF guard, CDN allowlist, redirect handling, byte caps and playlist
 * rewriting live in src/lib/mediaProxyCore.ts, which this Worker imports at
 * bundle time. Deploy from this repo so the shared module is included; keeping
 * one copy means the Worker and the Vercel handlers cannot drift.
 */
import {
  HLS_UPSTREAM_TIMEOUT_MS,
  MAX_HLS_SEGMENT_BYTES,
  MAX_PLAYLIST_BYTES,
  MAX_POSTER_BYTES,
  MAX_SUBTITLE_BYTES,
  STREAM_FETCH_TIMEOUT_MS,
  StreamResponseTooLargeError,
  StreamUrlError,
  assertAllowedPosterUrl,
  assertAllowedStreamUrl,
  assertAllowedSubtitleUrl,
  fetchStreamWithRedirects,
  readBodyCapped,
  readTextCapped,
  refererForStreamUrl,
  rewritePlaylist,
  stripPngWrapper,
} from '../../../src/lib/mediaProxyCore';

export interface Env {
  MEDIA_PROXY_SECRET?: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
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

function readFailure(error: unknown): Response {
  const message =
    error instanceof StreamResponseTooLargeError
      ? 'Upstream response too large'
      : 'Upstream response unavailable';
  return new Response(message, { status: 502, headers: corsHeaders() });
}

async function handleVtt(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return new Response('url is required', { status: 400, headers: corsHeaders() });
  }

  let parsed: URL;
  try {
    parsed = assertAllowedSubtitleUrl(target);
  } catch {
    return new Response('only https:// subtitle URLs on permitted hosts are allowed', {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // CDN hosts enforce hotlink protection — send trusted Referer
  const referer = refererForStreamUrl(parsed.href);

  let upstream: Response;
  try {
    upstream = await fetchStreamWithRedirects(
      parsed.href,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'text/vtt, text/plain, */*',
          Referer: referer,
          Origin: new URL(referer).origin,
        },
      },
      { timeoutMs: STREAM_FETCH_TIMEOUT_MS, validate: assertAllowedSubtitleUrl }
    );
  } catch (error) {
    const message =
      error instanceof StreamUrlError
        ? 'Upstream redirect not allowed'
        : 'Upstream subtitle fetch failed';
    return new Response(message, { status: 502, headers: corsHeaders() });
  }

  if (!upstream.ok) {
    return new Response(`Upstream ${upstream.status}`, { status: 502, headers: corsHeaders() });
  }

  let text: string;
  try {
    text = await readTextCapped(upstream, MAX_SUBTITLE_BYTES);
  } catch (error) {
    return readFailure(error);
  }
  const isAss = /\.(ass|ssa)(\?|$)/i.test(parsed.pathname);
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
    parsed = assertAllowedStreamUrl(target);
  } catch (error) {
    const message = error instanceof StreamUrlError ? error.message : 'url not allowed';
    return new Response(message, { status: 400, headers: corsHeaders() });
  }

  const referer = refererForStreamUrl(parsed.href);
  const originHeader = new URL(referer).origin;

  let upstream: Response;
  try {
    upstream = await fetchStreamWithRedirects(
      parsed.href,
      {
        headers: {
          'User-Agent': UA,
          Referer: referer,
          Origin: originHeader,
          Accept: '*/*',
        },
      },
      { timeoutMs: HLS_UPSTREAM_TIMEOUT_MS }
    );
  } catch (error) {
    const message =
      error instanceof StreamUrlError
        ? 'Upstream redirect not allowed'
        : 'Upstream stream fetch failed';
    return new Response(message, { status: 502, headers: corsHeaders() });
  }

  if (!upstream.ok) {
    return new Response(`Upstream ${upstream.status}`, { status: 502, headers: corsHeaders() });
  }

  const finalUrl = upstream.url || parsed.href;

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist =
    ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8(\?|$)/i.test(parsed.pathname);

  const proxyBase = `${workerOrigin}/hls`;
  const vttBase = `${workerOrigin}/vtt`;
  const key = (env.MEDIA_PROXY_SECRET || '').trim() || null;

  if (isPlaylist) {
    let text: string;
    try {
      text = await readTextCapped(upstream, MAX_PLAYLIST_BYTES);
    } catch (error) {
      return readFailure(error);
    }
    const rewritten = rewritePlaylist(text, finalUrl, proxyBase, vttBase, key);
    return new Response(rewritten, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      }),
    });
  }

  const isVtt = ct.includes('vtt') || /\.vtt(\?|$)/i.test(parsed.pathname);
  const isAss =
    ct.includes('ass') || ct.includes('ssa') || /\.(ass|ssa)(\?|$)/i.test(parsed.pathname);

  if (isVtt || isAss) {
    let text: string;
    try {
      text = await readTextCapped(upstream, MAX_SUBTITLE_BYTES);
    } catch (error) {
      return readFailure(error);
    }
    return new Response(text, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': isAss ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      }),
    });
  }

  let raw: Uint8Array;
  try {
    raw = await readBodyCapped(upstream, MAX_HLS_SEGMENT_BYTES);
  } catch (error) {
    return readFailure(error);
  }
  const media = stripPngWrapper(raw);

  return new Response(new Uint8Array(media), {
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
    parsed = assertAllowedPosterUrl(target);
  } catch (error) {
    const message = error instanceof StreamUrlError ? error.message : 'url host not allowed';
    return new Response(message, { status: 400, headers: corsHeaders() });
  }

  const site = 'https://hianime.lu';
  const tries: Array<[string, string]> = [
    ['', ''],
    [`${site}/`, site],
  ];

  for (const [referer, origin] of tries) {
    try {
      const headers: Record<string, string> = {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      };
      if (referer) headers.Referer = referer;
      if (origin) headers.Origin = origin;

      const upstream = await fetchStreamWithRedirects(
        parsed.href,
        { headers },
        { timeoutMs: 8_000, validate: assertAllowedPosterUrl }
      );
      if (!upstream.ok) continue;
      const contentType = upstream.headers.get('content-type') || '';
      if (!/^image\//i.test(contentType) && !/octet-stream/i.test(contentType)) continue;

      const bytes = await readBodyCapped(upstream, MAX_POSTER_BYTES);
      if (!bytes.length) continue;
      const type = /^image\//i.test(contentType) ? contentType : 'image/jpeg';
      return new Response(new Uint8Array(bytes), {
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
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
      }

      const url = new URL(request.url);
      const workerOrigin = url.origin;
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (path === '/') {
        return new Response(
          JSON.stringify({
            ok: true,
            service: 'hianime-media-proxy',
            routes: ['/hls?url=&k=', '/vtt?url=', '/poster?url='],
            auth: Boolean((env.MEDIA_PROXY_SECRET || '').trim()),
          }),
          {
            status: 200,
            headers: corsHeaders({ 'Content-Type': 'application/json' }),
          }
        );
      }

      if (path === '/hls' && !authOk(request, env)) {
        return new Response('invalid or missing media proxy key', {
          status: 401,
          headers: corsHeaders(),
        });
      }

      if (path === '/hls') return await handleHls(request, workerOrigin, env);
      if (path === '/vtt') return await handleVtt(request);
      if (path === '/poster') return await handlePoster(request);

      return new Response('Not found', { status: 404, headers: corsHeaders() });
    } catch {
      return new Response('Internal media proxy error', { status: 500, headers: corsHeaders() });
    }
  },
};

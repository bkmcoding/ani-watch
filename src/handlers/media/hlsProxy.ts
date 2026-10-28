import { Context } from 'hono';
import { validationError } from '../../lib/errors';
import {
  buildMediaProxyUrl,
  hlsProxyBase,
  isAllowedStreamHost,
  mediaProxyAuthOk,
  refererForStreamUrl,
  requestOrigin,
  vttProxyBase,
} from '../../lib/streamUrls';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

// NOTE: m3u8 playlist caching was removed. CDN segment URLs inside playlists
// are presigned and expire in seconds — a 30s cache returns stale segment URLs
// which causes HLS.js to buffer permanently after the first cache hit.
// We use in-flight request deduplication instead of storage caching.

const inFlightPlaylists = new Map<string, Promise<{ ok: boolean; status: number; text: string }>>();

export async function fetchPlaylistCoalesced(
  url: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; text: string }> {
  const existing = inFlightPlaylists.get(url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const upstream = await fetch(url, { headers, redirect: 'follow' });
      const text = upstream.ok ? await upstream.text() : '';
      return { ok: upstream.ok, status: upstream.status, text };
    } finally {
      inFlightPlaylists.delete(url);
    }
  })();

  inFlightPlaylists.set(url, promise);
  return promise;
}

function stripPngWrapper(buf: Buffer): Buffer {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const iend = buf.indexOf(Buffer.from('IEND'));
    if (iend > 0 && iend + 8 < buf.length) {
      const tail = buf.subarray(iend + 8);
      if (tail[0] === 0x47) return Buffer.from(tail);
    }
  }
  return buf;
}

export function isSubtitleUrl(url: string): boolean {
  try {
    return /\.(vtt|ass|ssa)(\?|$)/i.test(new URL(url).pathname);
  } catch {
    return /\.(vtt|ass|ssa)(\?|$)/i.test(url);
  }
}

export function rewritePlaylist(
  body: string,
  playlistUrl: string,
  proxyBase: string,
  vttBase?: string
): string {
  return body
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          try {
            const abs = new URL(uri, playlistUrl).href;
            if (vttBase && (line.includes('TYPE=SUBTITLES') || isSubtitleUrl(abs))) {
              return `URI="${vttBase}?url=${encodeURIComponent(abs)}"`;
            }
            return `URI="${buildMediaProxyUrl(proxyBase, abs)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }
      try {
        const abs = new URL(trimmed, playlistUrl).href;
        if (vttBase && isSubtitleUrl(abs)) {
          return `${vttBase}?url=${encodeURIComponent(abs)}`;
        }
        return buildMediaProxyUrl(proxyBase, abs);
      } catch {
        return line;
      }
    })
    .join('\n');
}

const hlsProxyController = async (c: Context) => {
  if (!mediaProxyAuthOk(c.req.query('k') || undefined)) {
    throw new validationError('invalid or missing media proxy key');
  }

  const target = c.req.query('url');
  if (!target) throw new validationError('url is required');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new validationError('url must be absolute');
  }

  if (parsed.protocol !== 'https:' || !isAllowedStreamHost(parsed.hostname)) {
    throw new validationError('url host not allowed');
  }

  const referer = refererForStreamUrl(parsed.href);
  let originHeader = 'https://megaplay.buzz';
  try {
    originHeader = new URL(referer).origin;
  } catch {
    // keep default
  }

  const fetchHeaders = {
    'User-Agent': UA,
    Referer: referer,
    Origin: originHeader,
    Accept: '*/*',
  };

  const origin = requestOrigin(c);
  const proxyBase = hlsProxyBase(origin);
  const vttBase = vttProxyBase(origin);

  // Detect playlist by URL alone (before fetching).
  const looksLikePlaylist = /\.m3u8(\?|$)/i.test(parsed.pathname);

  if (looksLikePlaylist) {
    const upstream = await fetchPlaylistCoalesced(parsed.href, fetchHeaders);
    if (!upstream.ok) return c.text(`Upstream ${upstream.status}`, 502);
    const rewritten = rewritePlaylist(upstream.text, parsed.href, proxyBase, vttBase);
    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Non-playlist: fetch upstream fresh
  const upstream = await fetch(parsed.href, { headers: fetchHeaders, redirect: 'follow' });

  if (!upstream.ok) {
    return c.text(`Upstream ${upstream.status}`, 502);
  }

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist = ct.includes('mpegurl') || ct.includes('m3u8');

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, parsed.href, proxyBase, vttBase);
    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const isVtt =
    ct.includes('text/vtt') || ct.includes('vtt') || /\.vtt(\?|$)/i.test(parsed.pathname);
  const isAss = /\.ass(\?|$)/i.test(parsed.pathname) || ct.includes('ass');

  if (isVtt || isAss) {
    const text = await upstream.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': isAss ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const media = stripPngWrapper(buf);
  return new Response(new Uint8Array(media), {
    status: 200,
    headers: {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export default hlsProxyController;

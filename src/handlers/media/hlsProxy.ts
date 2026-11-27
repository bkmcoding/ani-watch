import { Context } from 'hono';
import { validationError } from '../../lib/errors';
import {
  assertAllowedStreamUrl,
  fetchStreamWithRedirects,
  HLS_UPSTREAM_TIMEOUT_MS,
  MAX_HLS_SEGMENT_BYTES,
  MAX_PLAYLIST_BYTES,
  MAX_SUBTITLE_BYTES,
  readBodyCapped,
  readTextCapped,
  refererForStreamUrl,
  rewritePlaylist,
  StreamResponseTooLargeError,
  StreamUrlError,
  stripPngWrapper,
} from '../../lib/mediaProxyCore';
import {
  hlsProxyBase,
  mediaProxyAuthOk,
  mediaProxySecret,
  requestOrigin,
  vttProxyBase,
} from '../../lib/streamUrls';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

// NOTE: m3u8 playlist caching was removed. CDN segment URLs inside playlists
// are presigned and expire in seconds — a 30s cache returns stale segment URLs
// which causes HLS.js to buffer permanently after the first cache hit.
// We use in-flight request deduplication instead of storage caching.

interface PlaylistResult {
  ok: boolean;
  status: number;
  text: string;
  finalUrl: string;
}

const inFlightPlaylists = new Map<string, Promise<PlaylistResult>>();

/** Map a capped-body read failure to a gateway error. */
function readFailure(c: Context, error: unknown): Response {
  if (error instanceof StreamResponseTooLargeError) {
    return c.text('Upstream response too large', 502);
  }
  return c.text('Upstream response unavailable', 502);
}

export async function fetchPlaylistCoalesced(
  url: string,
  headers: Record<string, string>
): Promise<PlaylistResult> {
  const existing = inFlightPlaylists.get(url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      // Redirects are followed manually so every hop goes through the SSRF guard.
      const upstream = await fetchStreamWithRedirects(
        url,
        { headers },
        { timeoutMs: HLS_UPSTREAM_TIMEOUT_MS }
      );
      const text = upstream.ok ? await readTextCapped(upstream, MAX_PLAYLIST_BYTES) : '';
      return { ok: upstream.ok, status: upstream.status, text, finalUrl: upstream.url || url };
    } catch {
      return { ok: false, status: 502, text: '', finalUrl: url };
    } finally {
      inFlightPlaylists.delete(url);
    }
  })();

  inFlightPlaylists.set(url, promise);
  return promise;
}

const hlsProxyController = async (c: Context) => {
  if (!mediaProxyAuthOk(c.req.query('k') || undefined)) {
    throw new validationError('invalid or missing media proxy key');
  }

  const target = c.req.query('url');
  if (!target) throw new validationError('url is required');

  let parsed: URL;
  try {
    parsed = assertAllowedStreamUrl(target);
  } catch (error) {
    throw new validationError(error instanceof StreamUrlError ? error.message : 'url not allowed');
  }

  const referer = refererForStreamUrl(parsed.href);
  const originHeader = new URL(referer).origin;

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
    const rewritten = rewritePlaylist(
      upstream.text,
      upstream.finalUrl,
      proxyBase,
      vttBase,
      mediaProxySecret()
    );
    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Non-playlist: fetch upstream fresh, re-validating every redirect hop.
  let upstream: Response;
  try {
    upstream = await fetchStreamWithRedirects(
      parsed.href,
      { headers: fetchHeaders },
      { timeoutMs: HLS_UPSTREAM_TIMEOUT_MS }
    );
  } catch (error) {
    const message =
      error instanceof StreamUrlError ? 'Upstream redirect not allowed' : 'Upstream fetch failed';
    return c.text(message, 502);
  }

  if (!upstream.ok) {
    return c.text(`Upstream ${upstream.status}`, 502);
  }

  const finalUrl = upstream.url || parsed.href;

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist = ct.includes('mpegurl') || ct.includes('m3u8');

  if (isPlaylist) {
    let text: string;
    try {
      text = await readTextCapped(upstream, MAX_PLAYLIST_BYTES);
    } catch (error) {
      return readFailure(c, error);
    }
    const rewritten = rewritePlaylist(text, finalUrl, proxyBase, vttBase, mediaProxySecret());
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
  const isAss =
    /\.(ass|ssa)(\?|$)/i.test(parsed.pathname) || ct.includes('ass') || ct.includes('ssa');

  if (isVtt || isAss) {
    let text: string;
    try {
      text = await readTextCapped(upstream, MAX_SUBTITLE_BYTES);
    } catch (error) {
      return readFailure(c, error);
    }
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': isAss ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  let buf: Uint8Array;
  try {
    buf = await readBodyCapped(upstream, MAX_HLS_SEGMENT_BYTES);
  } catch (error) {
    return readFailure(c, error);
  }
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

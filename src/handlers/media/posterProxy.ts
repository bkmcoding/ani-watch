import { Context } from 'hono';
import config from '../../config/config';
import { validationError } from '../../lib/errors';
import {
  assertAllowedPosterUrl,
  fetchStreamWithRedirects,
  MAX_POSTER_BYTES,
  readBodyCapped,
  StreamUrlError,
} from '../../lib/mediaProxyCore';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 200;
type CacheEntry = { buf: Buffer; type: string; expires: number };
const posterCache = new Map<string, CacheEntry>();
/** Coalesce concurrent fetches for the same poster URL. */
const inflight = new Map<string, Promise<CacheEntry | null>>();

function cacheGet(key: string): CacheEntry | null {
  const hit = posterCache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    posterCache.delete(key);
    return null;
  }
  // LRU touch
  posterCache.delete(key);
  posterCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, entry: CacheEntry) {
  if (posterCache.size >= CACHE_MAX) {
    const oldest = posterCache.keys().next().value;
    if (oldest) posterCache.delete(oldest);
  }
  posterCache.set(key, entry);
}

async function fetchPoster(
  url: string,
  referer: string,
  origin: string
): Promise<{ buf: Buffer; type: string } | null> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
    if (referer) headers.Referer = referer;
    if (origin) headers.Origin = origin;

    // Manual redirects: only hosts on the shared allowlist can be reached,
    // including every hop, and the image body is size-bounded.
    const upstream = await fetchStreamWithRedirects(
      url,
      { headers },
      { timeoutMs: 8_000, validate: assertAllowedPosterUrl }
    );
    if (!upstream.ok) return null;
    const contentType = upstream.headers.get('content-type') || '';
    if (!/^image\//i.test(contentType) && !/octet-stream/i.test(contentType)) return null;
    const bytes = await readBodyCapped(upstream, MAX_POSTER_BYTES);
    if (!bytes.length) return null;
    return {
      buf: Buffer.from(bytes),
      type: /^image\//i.test(contentType) ? contentType : 'image/jpeg',
    };
  } catch {
    return null;
  }
}

async function loadPoster(href: string): Promise<CacheEntry | null> {
  const cached = cacheGet(href);
  if (cached) return cached;

  const pending = inflight.get(href);
  if (pending) return pending;

  const job = (async () => {
    const site = String(config.baseurl || 'https://hianime.lu').replace(/\/+$/, '');
    const tries: Array<[string, string]> = [
      ['', ''], // no-referer first — anipixcdn allows it and is fastest
      [`${site}/`, site],
      ['https://hianime.lu/', 'https://hianime.lu'],
    ];

    for (const [referer, origin] of tries) {
      const result = await fetchPoster(href, referer, origin || new URL(href).origin);
      if (!result) continue;
      const entry: CacheEntry = {
        buf: result.buf,
        type: result.type,
        expires: Date.now() + CACHE_TTL_MS,
      };
      cacheSet(href, entry);
      return entry;
    }
    return null;
  })().finally(() => {
    inflight.delete(href);
  });

  inflight.set(href, job);
  return job;
}

/**
 * Proxies HiAnime poster CDNs (allowlisted) with a short-lived in-memory cache.
 *
 * No `k` gate: the key used to be written into the public /browse page source,
 * so it protected nothing. Posters are public images constrained by the CDN
 * allowlist; MEDIA_PROXY_SECRET is reserved for the bandwidth-heavy /hls path.
 */
const posterProxyController = async (c: Context) => {
  const target = c.req.query('url');
  if (!target) throw new validationError('url is required');

  let parsed: URL;
  try {
    parsed = assertAllowedPosterUrl(target);
  } catch (error) {
    throw new validationError(
      error instanceof StreamUrlError ? error.message : 'url host not allowed'
    );
  }

  const fromCache = cacheGet(parsed.href);
  if (fromCache) {
    return new Response(new Uint8Array(fromCache.buf), {
      status: 200,
      headers: {
        'Content-Type': fromCache.type,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'X-Poster-Cache': 'HIT',
      },
    });
  }

  const entry = await loadPoster(parsed.href);
  if (!entry) {
    return c.text('Upstream image unavailable', 502);
  }

  return new Response(new Uint8Array(entry.buf), {
    status: 200,
    headers: {
      'Content-Type': entry.type,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Access-Control-Allow-Origin': '*',
      'X-Poster-Cache': 'MISS',
    },
  });
};

export default posterProxyController;

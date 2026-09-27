import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { isAllowedPosterHost } from '../utils/posterUrls';
import { mediaProxyAuthOk } from '../utils/streamUrls';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

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

async function fetchPoster(url: string, referer: string, origin: string): Promise<Response | null> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
    if (referer) headers.Referer = referer;
    if (origin) headers.Origin = origin;

    const upstream = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok) return null;
    const contentType = upstream.headers.get('content-type') || '';
    if (!/^image\//i.test(contentType) && !/octet-stream/i.test(contentType)) return null;
    return upstream;
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
      const upstream = await fetchPoster(href, referer, origin || new URL(href).origin);
      if (!upstream) continue;
      const type = upstream.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (!buf.length) continue;
      const entry: CacheEntry = {
        buf,
        type: /^image\//i.test(type) ? type : 'image/jpeg',
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

/** Proxies HiAnime poster CDNs (allowlisted) with short-lived in-memory cache. */
const posterProxyController = async (c: Context) => {
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

  if (!/^https?:$/i.test(parsed.protocol) || !isAllowedPosterHost(parsed.hostname)) {
    throw new validationError('url host not allowed');
  }

  const fromCache = cacheGet(parsed.href);
  if (fromCache) {
    return new Response(fromCache.buf, {
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

  return new Response(entry.buf, {
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

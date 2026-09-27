import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { isAllowedPosterHost } from '../utils/posterUrls';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

async function fetchPoster(url: string, referer: string, origin: string): Promise<Response | null> {
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Referer: referer,
        Origin: origin,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) return null;
    const contentType = upstream.headers.get('content-type') || '';
    if (!/^image\//i.test(contentType) && !/octet-stream/i.test(contentType)) return null;
    return upstream;
  } catch {
    return null;
  }
}

/** Proxies HiAnime poster CDNs (allowlisted). Tries site referer, then no-referer. */
const posterProxyController = async (c: Context) => {
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

  const site = String(config.baseurl || 'https://hianime.lu').replace(/\/+$/, '');
  const tries: Array<[string, string]> = [
    [`${site}/`, site],
    ['https://hianime.lu/', 'https://hianime.lu'],
    ['', ''],
  ];

  let upstream: Response | null = null;
  for (const [referer, origin] of tries) {
    upstream = await fetchPoster(parsed.href, referer, origin || parsed.origin);
    if (upstream) break;
  }

  if (!upstream) {
    return c.text('Upstream image unavailable', 502);
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await upstream.arrayBuffer());
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': /^image\//i.test(contentType) ? contentType : 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export default posterProxyController;

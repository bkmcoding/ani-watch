import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { isAllowedPosterHost } from '../utils/posterUrls';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

/** Proxies HiAnime poster CDNs with a valid Referer (Bunny hotlink protection). */
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
  const referer = `${site}/`;

  const upstream = await fetch(parsed.href, {
    headers: {
      'User-Agent': UA,
      Referer: referer,
      Origin: site,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!upstream.ok) {
    return c.text(`Upstream ${upstream.status}`, 502);
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  if (!/^image\//i.test(contentType) && !/octet-stream/i.test(contentType)) {
    return c.text('Upstream was not an image', 502);
  }

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

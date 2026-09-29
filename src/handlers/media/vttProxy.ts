import { Context } from 'hono';
import { validationError } from '../../lib/errors';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

/**
 * Subtitle (VTT/ASS) proxy — accepts any https:// URL, no auth required.
 *
 * Unlike the HLS proxy, this endpoint does not require MEDIA_PROXY_SECRET.
 * Subtitles are plain text (VTT/ASS), not video bytes, so there is no
 * bandwidth-abuse vector worth guarding with a shared secret.  Requiring
 * auth caused spurious 401s when the secret was set on Vercel but the
 * watch-page URL was built before the secret existed (or vice-versa).
 *
 * Security posture:
 *  - HTTPS only (no plain-HTTP fetches).
 *  - Response Content-Type is always forced to text/vtt or text/plain —
 *    the upstream Content-Type is never forwarded as-is.
 *  - No response headers from the upstream are forwarded.
 */
const vttProxyController = async (c: Context) => {
  const target = c.req.query('url');
  if (!target) throw new validationError('url is required');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new validationError('url must be absolute');
  }

  if (parsed.protocol !== 'https:') {
    throw new validationError('only https:// subtitle URLs are allowed');
  }

  // CDN hosts (broforgotsave.online, etc.) enforce hotlink protection —
  // they return 403 without a trusted Referer.  MegaPlay CDNs expect the
  // embed origin; Zoko CDNs expect the Zoko player origin.
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
    signal: AbortSignal.timeout(15_000),
  });

  if (!upstream.ok) {
    return c.text(`Upstream ${upstream.status}`, 502);
  }

  const text = await upstream.text();

  const isAss = /\.ass(\?|$)/i.test(parsed.pathname);
  const contentType = isAss ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8';

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=600',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export default vttProxyController;

import { Context } from 'hono';
import { validationError } from '../../lib/errors';
import {
  assertAllowedSubtitleUrl,
  fetchStreamWithRedirects,
  MAX_SUBTITLE_BYTES,
  readTextCapped,
  STREAM_FETCH_TIMEOUT_MS,
  StreamResponseTooLargeError,
  StreamUrlError,
} from '../../lib/mediaProxyCore';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

/**
 * Subtitle (VTT/ASS) proxy — no auth required, but restricted to the same CDN
 * allowlist as the poster proxy. It previously accepted any public https host,
 * which made it an open fetch relay.
 *
 * Security posture:
 *  - HTTPS only (no plain-HTTP fetches).
 *  - The initial URL and every redirect hop must be on the shared CDN
 *    allowlist, so a public CDN cannot bounce us to another host.
 *  - Response bodies are capped, so a huge upstream cannot exhaust memory.
 *  - Response Content-Type is always forced to text/vtt or text/plain —
 *    the upstream Content-Type is never forwarded as-is.
 *  - No response headers from the upstream are forwarded.
 */
const vttProxyController = async (c: Context) => {
  const target = c.req.query('url');
  if (!target) throw new validationError('url is required');

  let parsed: URL;
  try {
    parsed = assertAllowedSubtitleUrl(target);
  } catch {
    throw new validationError('only https:// subtitle URLs on permitted hosts are allowed');
  }

  // CDN hosts (broforgotsave.online, etc.) enforce hotlink protection —
  // they return 403 without a trusted Referer.  MegaPlay CDNs expect the
  // embed origin; Zoko CDNs expect the Zoko player origin.
  const referer =
    parsed.hostname.includes('aniwatchtv') || parsed.hostname.includes('zoko')
      ? 'https://zokoanime.video/'
      : 'https://megaplay.buzz/';

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
      error instanceof StreamUrlError ? 'Upstream redirect not allowed' : 'Upstream fetch failed';
    return c.text(message, 502);
  }

  if (!upstream.ok) {
    return c.text(`Upstream ${upstream.status}`, 502);
  }

  let text: string;
  try {
    text = await readTextCapped(upstream, MAX_SUBTITLE_BYTES);
  } catch (error) {
    const message =
      error instanceof StreamResponseTooLargeError
        ? 'Upstream response too large'
        : 'Upstream subtitle fetch failed';
    return c.text(message, 502);
  }

  const isAss = /\.(ass|ssa)(\?|$)/i.test(parsed.pathname);
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

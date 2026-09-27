import { Context } from 'hono';

/** Public site origin (honours proxy headers; forces https on non-local hosts). */
export function requestOrigin(c: Context): string {
  const url = new URL(c.req.url);
  const xfProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const xfHost = (c.req.header('x-forwarded-host') || c.req.header('host') || url.host)
    .split(',')[0]
    ?.trim();
  const host = xfHost || url.host;
  let proto = xfProto || url.protocol.replace(':', '') || 'https';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  if (!local && proto === 'http') proto = 'https';
  return `${proto}://${host}`;
}

export function proxiedHlsUrl(origin: string, m3u8: string): string {
  return `${origin.replace(/\/+$/, '')}/api/v2/hianime/hls?url=${encodeURIComponent(m3u8)}`;
}

export function watchPageUrl(origin: string, m3u8: string): string {
  return `${origin.replace(/\/+$/, '')}/api/v2/hianime/watch?url=${encodeURIComponent(m3u8)}`;
}

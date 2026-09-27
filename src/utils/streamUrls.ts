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

const ALLOWED_HOST_SUFFIXES = [
  'megaplay.buzz',
  'shiora.top',
  'akirax.buzz',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'hiddenvertex.top',
];

/** CDN hosts used by MegaPlay playlists / segments. */
export function isAllowedStreamHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host.startsWith('megap.')) return true;
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
}

export function proxiedHlsUrl(origin: string, m3u8: string): string {
  return `${origin.replace(/\/+$/, '')}/api/v2/hianime/hls?url=${encodeURIComponent(m3u8)}`;
}

/** Browser player URL. Pass CDN m3u8(s); page shows Sub/Dub toggle when both exist. */
export function watchPageUrl(
  origin: string,
  opts: { sub?: string | null; dub?: string | null; category?: string }
): string {
  const base = origin.replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (opts.sub) params.set('sub', opts.sub);
  if (opts.dub) params.set('dub', opts.dub);
  const preferred =
    opts.category === 'dub' && opts.dub
      ? 'dub'
      : opts.category === 'sub' && opts.sub
        ? 'sub'
        : opts.sub
          ? 'sub'
          : opts.dub
            ? 'dub'
            : 'sub';
  params.set('t', preferred);
  const primary = preferred === 'dub' ? opts.dub : opts.sub || opts.dub;
  if (primary) params.set('url', primary);
  return `${base}/api/v2/hianime/watch?${params.toString()}`;
}

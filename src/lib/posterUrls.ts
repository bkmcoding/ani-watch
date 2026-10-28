import { buildMediaProxyUrl, posterProxyBase } from './streamUrls';

/** HiAnime / Zoro thumbnail hosts (BunnyCDN hotlink-protected). */
const POSTER_ALLOWED_DOMAINS = [
  'anipixcdn.co',
  'noitatnemucod.net',
  'bunnycdn.ru',
  'b-cdn.net',
  'wsrv.nl',
  'weserv.nl',
  'hianime.lu',
  'hianime.to',
  'aniwatchtv.to',
];

export function isAllowedPosterHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') return false;
  const host = hostname.trim().toLowerCase();
  return POSTER_ALLOWED_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
}

/** Same-origin (or MEDIA_PROXY_ORIGIN) proxy so browse can show posters despite CDN hotlink rules. */
export function proxiedPosterUrl(origin: string, poster: string | null | undefined): string | null {
  if (!poster || !/^https?:\/\//i.test(poster)) return null;
  try {
    const host = new URL(poster).hostname;
    if (!isAllowedPosterHost(host)) return poster;
  } catch {
    return null;
  }
  return buildMediaProxyUrl(posterProxyBase(origin), poster);
}

import { buildMediaProxyUrl, posterProxyBase } from './streamUrls';

/** HiAnime / Zoro thumbnail hosts (BunnyCDN hotlink-protected). */
const POSTER_HOST_SUFFIXES = [
  'anipixcdn.co',
  'noitatnemucod.net',
  'bunnycdn.ru',
  'b-cdn.net',
  'wsrv.nl',
  'weserv.nl',
];

export function isAllowedPosterHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (POSTER_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s))) return true;
  // Common HiAnime / Zoro thumbnail CDNs
  if (host.includes('anipix') || host.includes('noitatnemucod')) return true;
  return false;
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

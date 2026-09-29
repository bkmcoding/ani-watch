import config from '../config/config';
import { axiosInstance } from '../services/axiosInstance';

export function htmlFromAjax(payload: string): string {
  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed?.html === 'string') return parsed.html;
  } catch {
    // raw HTML
  }
  return payload;
}

/** Numeric anime id from slug like `one-piece-1`. */
export function animeNumericId(animeId: string): string {
  const num = animeId.split('-').at(-1);
  if (!num || !/^\d+$/.test(num)) {
    throw new Error(`Invalid anime id: ${animeId}`);
  }
  return num;
}

/**
 * Episode numeric id from `one-piece-1?ep=1` / `one-piece-1::1` / bare `1`.
 * Theme API uses the `ep` query value as episodeId.
 */
export function episodeNumericId(episodeId: string): string {
  const normalized = episodeId.replace('::', '?');
  const fromQuery = normalized.match(/[?&]ep=(\d+)/i)?.[1];
  if (fromQuery) return fromQuery;
  if (/^\d+$/.test(normalized)) return normalized;
  throw new Error(`Invalid episode id: ${episodeId}`);
}

export function animeSlugFromEpisodeId(episodeId: string): string | null {
  const normalized = episodeId.replace('::', '?');
  const slug = normalized.split('?')[0]?.trim();
  return slug || null;
}

/** Theme AJAX — cached per endpoint:
 *  - episode/list: 10 minutes (changes weekly for airing, never for completed)
 *  - everything else: 2 minutes
 */
export async function fetchTheme(path: string, refererPath?: string) {
  const referer = refererPath
    ? `${config.baseurl}${refererPath.startsWith('/') ? refererPath : `/${refererPath}`}`
    : `${config.baseurl}/`;

  const isEpisodeList = path.startsWith('episode/list');
  const ttl = isEpisodeList ? 600_000 : 120_000;

  return axiosInstance(`/api/theme/${path.replace(/^\//, '')}`, {
    headers: {
      Referer: referer,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
    },
    cacheTtlMs: ttl,
  });
}

import { UserError } from './resolve.js';

/**
 * HiAnime through the self-hosted hianime-api.
 * BOT_SECRET_KEY is sent as x-api-key.
 * Host defaults to ani.bkmcoding.com; HIANIME_API_URL overrides it.
 *
 * Search → episode list → episode/sources (MegaPlay HLS), ani-cli style.
 */
const FETCH_TIMEOUT_MS = 20_000;

function baseUrl() {
  return (process.env.HIANIME_API_URL || 'https://ani.bkmcoding.com').replace(/\/+$/, '');
}

function requestHeaders() {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'tibblesbotbig (Discord bot)',
  };
  if (process.env.BOT_SECRET_KEY) headers['x-api-key'] = process.env.BOT_SECRET_KEY;
  return headers;
}

async function getJson(path, label, ms = FETCH_TIMEOUT_MS) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      headers: requestHeaders(),
      signal: AbortSignal.timeout(ms),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new UserError(
      timedOut
        ? `${label} took too long to respond - try again shortly.`
        : 'Could not reach the anime API - try again shortly.',
      { cause: err },
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new UserError(
      process.env.BOT_SECRET_KEY
        ? 'The anime API rejected BOT_SECRET_KEY.'
        : 'Set BOT_SECRET_KEY to use /anime.',
    );
  }

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }

  if (!res.ok || body?.success === false) {
    throw new UserError(
      res.status === 404 ? 'Nothing found for that.' : `${label} failed - try again shortly.`,
    );
  }
  if (body == null || typeof body !== 'object') {
    throw new UserError(`${label} didn't return JSON.`);
  }
  return body.data ?? body;
}

function audioLabel(episodes) {
  const sub = Number(episodes?.sub) > 0;
  const dub = Number(episodes?.dub) > 0;
  if (sub && dub) return 'sub & dub';
  if (dub) return 'dub';
  if (sub) return 'sub';
  return undefined;
}

/** Normalize aniwatch-style or legacy list items. */
function asSearchHit(item) {
  const id = item?.id;
  const title = item?.name || item?.title;
  if (!id || !title) return null;
  if (/^(18\+|rx)$/i.test(item.rating ?? '')) return null;
  return {
    id,
    title,
    image: item.poster,
    releaseDate: item.type || undefined,
    subOrDub: audioLabel(item.episodes),
  };
}

/** First page of results, capped at Discord's select-menu limit. */
export async function searchAnime(query) {
  const params = new URLSearchParams({ q: query, page: '1' });
  const data = await getJson(`/api/v2/hianime/search?${params}`, 'Anime search');
  const raw = data?.animes ?? data?.response ?? [];
  const results = raw.map(asSearchHit).filter(Boolean).slice(0, 25);
  if (!results.length) throw new UserError(`No anime found for "${query}".`);
  return results;
}

/** Title from the search hit, episodes from the list endpoint. */
export async function animeInfo(anime) {
  const id = typeof anime === 'string' ? anime : anime.id;
  const data = await getJson(
    `/api/v2/hianime/anime/${encodeURIComponent(id)}/episodes`,
    'That anime',
  );

  const list = Array.isArray(data) ? data : (data?.episodes ?? []);
  const episodes = list
    .map((episode, index) => {
      const episodeId = episode.episodeId || episode.id;
      if (!episodeId) return null;
      const number = episode.number ?? episode.episodeNumber ?? index + 1;
      let title =
        episode.title && episode.title !== `Episode ${number}` ? episode.title : undefined;
      if (episode.isFiller) title = title ? `${title} · filler` : 'Filler';
      return { id: episodeId, number, title };
    })
    .filter(Boolean);

  const title = (typeof anime === 'object' && anime.title) || id;
  if (!episodes.length) {
    throw new UserError(
      `**${title}** has no episodes listed (this scrape source may not expose episode AJAX yet).`,
    );
  }
  return {
    id,
    title,
    image: typeof anime === 'object' ? anime.image : undefined,
    audio: typeof anime === 'object' && anime.subOrDub === 'dub' ? 'dub' : 'sub',
    episodes,
  };
}

/** 1080 outranks 720, and any numbered quality outranks "default" or "auto". */
function qualityRank(source) {
  const match = String(source?.quality ?? '').match(/(\d{3,4})/);
  return match ? Number(match[1]) : 0;
}

/**
 * Highest .m3u8 in a watch payload, plus the Referer the CDN usually demands.
 */
export function pickStream(payload) {
  const listed = (payload?.sources ?? []).filter(
    (source) => source?.url && (source.isM3U8 || /\.m3u8(\?|$)/i.test(source.url)),
  );
  const master = listed.find((source) => /^https?:\/\//i.test(source.url))?.url;
  const streams = listed.flatMap((source) => {
    let url = source.url;
    if (!/^https?:\/\//i.test(url)) {
      if (!master) return [];
      try {
        url = new URL(url, master).href;
      } catch {
        return [];
      }
    }
    return [{ ...source, url }];
  });
  if (!streams.length) return null;

  streams.sort((a, b) => qualityRank(b) - qualityRank(a));
  const best = streams[0];
  const rank = qualityRank(best);
  const headers = payload.headers ?? {};
  return {
    url: best.url,
    quality: rank ? `${rank}p` : best.quality || 'auto',
    referer: headers.Referer || headers.referer || null,
  };
}

/** Resolve a playable HLS stream for an episode (ani-cli style). */
export async function watchAnime(episodeId, audio = 'sub') {
  const category = audio === 'dub' ? 'dub' : 'sub';
  const params = new URLSearchParams({
    animeEpisodeId: episodeId,
    server: 'hd-1',
    category,
  });
  const data = await getJson(`/api/v2/hianime/episode/sources?${params}`, 'Episode stream', 45_000);
  const stream = pickStream(data);
  if (!stream) {
    throw new UserError('No playable stream found for that episode.');
  }
  return stream;
}

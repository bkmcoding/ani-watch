import {
  parseThemeServers,
  pickServer,
  resolveMegaPlaySources,
  ThemeServer,
} from './megaplay';
import { resolveZokoSources } from './zoko';
import { extractEpisodes } from '../extractor/extractEpisodes';
import {
  animeNumericId,
  animeSlugFromEpisodeId,
  episodeNumericId,
  fetchTheme,
  htmlFromAjax,
} from '../utils/themeAjax';
import {
  pickEnglishSubtitle,
  proxiedHlsUrl,
  watchPageUrl,
} from '../utils/streamUrls';
import { titleFromAnimeSlug } from '../utils/brand';

function pickMegaPlay(servers: ThemeServer[], category: string, server: string) {
  const picked = pickServer(servers, server, category);
  if (picked && /megaplay/i.test(picked.embedUrl)) return picked;
  return pickServer(
    servers.filter((s) => /megaplay/i.test(s.embedUrl)),
    'hd-1',
    category
  );
}

function pickZoko(servers: ThemeServer[], category: string) {
  const pool = servers.filter((s) => s.type === category && /zoko/i.test(s.embedUrl));
  return pool[0] || null;
}

async function resolveCategory(
  servers: ThemeServer[],
  category: 'sub' | 'dub',
  server: string
) {
  const mega = pickMegaPlay(servers, category, server);
  if (mega) {
    try {
      const stream = await resolveMegaPlaySources(mega.embedUrl);
      const m3u8 = stream.sources[0]?.url;
      if (m3u8) {
        return {
          category,
          provider: 'megaplay' as const,
          server: mega.serverName.toLowerCase().replace(/\s+/g, '-'),
          m3u8,
          stream,
        };
      }
    } catch {
      // fall through to Zoko
    }
  }

  const zoko = pickZoko(servers, category);
  if (zoko) {
    try {
      const stream = await resolveZokoSources(zoko.embedUrl);
      const m3u8 = stream.sources[0]?.url;
      if (m3u8) {
        return {
          category,
          provider: 'zoko' as const,
          server: zoko.serverName.toLowerCase().replace(/\s+/g, '-'),
          m3u8,
          stream,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeEpisodeId(raw: string): string {
  return raw.includes('::') ? raw.replace('::', '?') : raw;
}

function playPageUrl(
  origin: string,
  episodeId: string,
  category: string
): string {
  const base = origin.replace(/\/+$/, '');
  const params = new URLSearchParams({
    animeEpisodeId: normalizeEpisodeId(episodeId),
    category: category === 'dub' ? 'dub' : 'sub',
  });
  return `${base}/api/v2/hianime/watch/play?${params.toString()}`;
}

async function findNeighbors(slug: string, currentEpNum: string) {
  try {
    const idNum = animeNumericId(slug);
    const list = await fetchTheme(`episode/list/${idNum}`, `/watch/${slug}`);
    if (!list.success || !list.data) return null;
    const episodes = extractEpisodes(htmlFromAjax(list.data));
    const idx = episodes.findIndex(
      (ep) =>
        String(ep.episodeNumber) === String(currentEpNum) ||
        (ep.id && episodeNumericId(normalizeEpisodeId(ep.id)) === String(currentEpNum))
    );
    if (idx < 0) return null;
    const current = episodes[idx];
    const prev = idx > 0 ? episodes[idx - 1] : null;
    const next = idx < episodes.length - 1 ? episodes[idx + 1] : null;
    return {
      current,
      prev,
      next,
      total: episodes.length,
      index: idx + 1,
    };
  } catch {
    return null;
  }
}

export type EpisodePlayback = {
  link: string;
  tracks: Record<string, unknown>;
  availableCategories: Array<'sub' | 'dub'>;
  sources: Array<Record<string, unknown>>;
  headers: Record<string, string>;
  server: string;
  category: string;
  provider: string;
  animeId: string | null;
  animeTitle: string;
  episodeId: string;
  episodeNumber: number | null;
  episodeTitle: string | null;
  navigation: {
    prev: string | null;
    next: string | null;
    index: number | null;
    total: number | null;
  };
  subtitles?: unknown;
  intro?: unknown;
  outro?: unknown;
  anilistID?: unknown;
  malID?: unknown;
};

/** Resolve MegaPlay/Zoko streams + watch link (+ prev/next play URLs). */
export async function resolveEpisodePlayback(
  origin: string,
  animeEpisodeId: string,
  opts?: { server?: string; category?: string }
): Promise<EpisodePlayback> {
  const server = (opts?.server || 'hd-1').toLowerCase();
  const preferred = (opts?.category || 'sub').toLowerCase();
  const episodeId = normalizeEpisodeId(animeEpisodeId);
  const epNum = episodeNumericId(episodeId);
  const slug = animeSlugFromEpisodeId(episodeId);
  const referer = slug ? `/watch/${slug}?ep=${epNum}` : `/`;

  const result = await fetchTheme(`episode/servers?episodeId=${epNum}`, referer);
  if (!result.success || !result.data) {
    throw new Error(result.message || 'could not load episode servers');
  }

  const servers = parseThemeServers(htmlFromAjax(result.data));
  const hasSub = servers.some((s) => s.type === 'sub');
  const hasDub = servers.some((s) => s.type === 'dub');

  const neighborsPromise = slug ? findNeighbors(slug, epNum) : Promise.resolve(null);

  const [subTrack, dubTrack, neighbors] = await Promise.all([
    hasSub ? resolveCategory(servers, 'sub', server) : Promise.resolve(null),
    hasDub ? resolveCategory(servers, 'dub', server) : Promise.resolve(null),
    neighborsPromise,
  ]);

  if (!subTrack && !dubTrack) {
    throw new Error('No playable sub/dub stream found for this episode');
  }

  const active =
    (preferred === 'dub' && dubTrack) ||
    (preferred === 'sub' && subTrack) ||
    subTrack ||
    dubTrack;

  if (!active) {
    throw new Error(`No ${preferred} stream available`);
  }

  const subCc = pickEnglishSubtitle(subTrack?.stream.subtitles);
  const dubCc = pickEnglishSubtitle(dubTrack?.stream.subtitles);
  const animeTitle = titleFromAnimeSlug(slug);
  const episodeTitle = neighbors?.current?.title || null;
  const episodeNumber =
    neighbors?.current?.episodeNumber ?? (Number(epNum) || null);

  const prevId = neighbors?.prev?.id
    ? normalizeEpisodeId(neighbors.prev.id)
    : null;
  const nextId = neighbors?.next?.id
    ? normalizeEpisodeId(neighbors.next.id)
    : null;

  const watchOpts = {
    sub: subTrack?.m3u8 || null,
    dub: dubTrack?.m3u8 || null,
    subCc,
    dubCc,
    animeId: slug,
    animeTitle,
    episodeId,
    episodeNumber,
    episodeTitle,
    prevPlay: prevId ? playPageUrl(origin, prevId, active.category) : null,
    nextPlay: nextId ? playPageUrl(origin, nextId, active.category) : null,
    epIndex: neighbors?.index ?? null,
    epTotal: neighbors?.total ?? null,
  };

  const link = watchPageUrl(origin, {
    ...watchOpts,
    category: active.category,
  });

  const tracks: Record<string, unknown> = {};
  for (const track of [subTrack, dubTrack]) {
    if (!track) continue;
    const enCc = pickEnglishSubtitle(track.stream.subtitles);
    tracks[track.category] = {
      link: watchPageUrl(origin, {
        ...watchOpts,
        category: track.category,
      }),
      streamUrl: proxiedHlsUrl(origin, track.m3u8),
      originalUrl: track.m3u8,
      server: track.server,
      provider: track.provider,
      subtitles: track.stream.subtitles,
      englishCc: enCc
        ? {
            url: proxiedHlsUrl(origin, enCc),
            originalUrl: enCc,
          }
        : null,
    };
  }

  return {
    ...active.stream,
    link,
    tracks,
    availableCategories: [
      ...(subTrack ? (['sub'] as const) : []),
      ...(dubTrack ? (['dub'] as const) : []),
    ],
    sources: [
      {
        url: link,
        isM3U8: false,
        quality: 'auto',
        type: 'link' as const,
        streamUrl: proxiedHlsUrl(origin, active.m3u8),
        originalUrl: active.m3u8,
      },
    ],
    headers: {
      Referer: `${origin}/`,
      'User-Agent': active.stream.headers['User-Agent'] || '',
    },
    server: active.server,
    category: active.category,
    provider: active.provider,
    animeId: slug,
    animeTitle,
    episodeId,
    episodeNumber,
    episodeTitle,
    navigation: {
      prev: prevId ? playPageUrl(origin, prevId, active.category) : null,
      next: nextId ? playPageUrl(origin, nextId, active.category) : null,
      index: neighbors?.index ?? null,
      total: neighbors?.total ?? null,
    },
  };
}

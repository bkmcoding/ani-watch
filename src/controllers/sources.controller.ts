import { Context } from 'hono';
import { validationError } from '../utils/errors';
import {
  parseThemeServers,
  pickServer,
  resolveMegaPlaySources,
  ThemeServer,
} from '../services/megaplay';
import { resolveZokoSources } from '../services/zoko';
import {
  animeSlugFromEpisodeId,
  episodeNumericId,
  fetchTheme,
  htmlFromAjax,
} from '../utils/themeAjax';
import {
  pickEnglishSubtitle,
  proxiedHlsUrl,
  requestOrigin,
  watchPageUrl,
} from '../utils/streamUrls';

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

const sourcesController = async (c: Context) => {
  const animeEpisodeId =
    c.req.query('animeEpisodeId') || c.req.query('episodeId') || c.req.param('episodeId');
  const server = (c.req.query('server') || 'hd-1').toLowerCase();
  // Always prefer sub unless the caller explicitly asks for dub.
  const preferred = (c.req.query('category') || c.req.query('type') || 'sub').toLowerCase();

  if (!animeEpisodeId) {
    throw new validationError('animeEpisodeId is required', {
      example: 'one-piece-1?ep=1',
    });
  }

  const epNum = episodeNumericId(animeEpisodeId);
  const slug = animeSlugFromEpisodeId(animeEpisodeId);
  const referer = slug ? `/watch/${slug}?ep=${epNum}` : `/`;

  const result = await fetchTheme(`episode/servers?episodeId=${epNum}`, referer);

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'could not load episode servers', {
      animeEpisodeId,
    });
  }

  const servers = parseThemeServers(htmlFromAjax(result.data));
  const hasSub = servers.some((s) => s.type === 'sub');
  const hasDub = servers.some((s) => s.type === 'dub');

  const [subTrack, dubTrack] = await Promise.all([
    hasSub ? resolveCategory(servers, 'sub', server) : Promise.resolve(null),
    hasDub ? resolveCategory(servers, 'dub', server) : Promise.resolve(null),
  ]);

  if (!subTrack && !dubTrack) {
    throw new validationError('No playable sub/dub stream found for this episode', {
      available: servers.map((s) => ({ type: s.type, serverName: s.serverName })),
    });
  }

  const origin = requestOrigin(c);
  // Prefer requested category, but never hide the other when both resolve.
  const active =
    (preferred === 'dub' && dubTrack) ||
    (preferred === 'sub' && subTrack) ||
    subTrack ||
    dubTrack;

  if (!active) {
    throw new validationError(`No ${preferred} stream available`);
  }

  const subCc = pickEnglishSubtitle(subTrack?.stream.subtitles);
  const dubCc = pickEnglishSubtitle(dubTrack?.stream.subtitles);
  const watchOpts = {
    sub: subTrack?.m3u8 || null,
    dub: dubTrack?.m3u8 || null,
    subCc,
    dubCc,
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
  };
};

export default sourcesController;

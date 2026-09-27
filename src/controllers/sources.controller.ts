import { Context } from 'hono';
import { validationError } from '../utils/errors';
import {
  parseThemeServers,
  pickServer,
  resolveMegaPlaySources,
  ThemeServer,
} from '../services/megaplay';
import {
  animeSlugFromEpisodeId,
  episodeNumericId,
  fetchTheme,
  htmlFromAjax,
} from '../utils/themeAjax';
import { proxiedHlsUrl, requestOrigin, watchPageUrl } from '../utils/streamUrls';

function pickMegaPlay(servers: ThemeServer[], category: string, server: string) {
  const picked = pickServer(servers, server, category);
  if (picked && /megaplay/i.test(picked.embedUrl)) return picked;
  return pickServer(
    servers.filter((s) => /megaplay/i.test(s.embedUrl)),
    'hd-1',
    category
  );
}

async function resolveCategory(
  servers: ThemeServer[],
  category: 'sub' | 'dub',
  server: string
) {
  const picked = pickMegaPlay(servers, category, server);
  if (!picked) return null;
  try {
    const stream = await resolveMegaPlaySources(picked.embedUrl);
    const m3u8 = stream.sources[0]?.url;
    if (!m3u8) return null;
    return {
      category,
      server: picked.serverName.toLowerCase().replace(/\s+/g, '-'),
      m3u8,
      stream,
    };
  } catch {
    return null;
  }
}

const sourcesController = async (c: Context) => {
  const animeEpisodeId =
    c.req.query('animeEpisodeId') || c.req.query('episodeId') || c.req.param('episodeId');
  const server = (c.req.query('server') || 'hd-1').toLowerCase();
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

  // Resolve available audio tracks in parallel (MegaPlay only).
  const [subTrack, dubTrack] = await Promise.all([
    hasSub ? resolveCategory(servers, 'sub', server) : Promise.resolve(null),
    hasDub ? resolveCategory(servers, 'dub', server) : Promise.resolve(null),
  ]);

  if (!subTrack && !dubTrack) {
    throw new validationError('No MegaPlay sub/dub stream found for this episode', {
      available: servers.map((s) => ({ type: s.type, serverName: s.serverName })),
    });
  }

  const origin = requestOrigin(c);
  const active =
    (preferred === 'dub' && dubTrack) ||
    (preferred === 'sub' && subTrack) ||
    subTrack ||
    dubTrack;

  if (!active) {
    throw new validationError(`No ${preferred} stream available`);
  }

  const link = watchPageUrl(origin, {
    sub: subTrack?.m3u8 || null,
    dub: dubTrack?.m3u8 || null,
    category: active.category,
  });

  const tracks: Record<string, unknown> = {};
  for (const track of [subTrack, dubTrack]) {
    if (!track) continue;
    tracks[track.category] = {
      link: watchPageUrl(origin, {
        sub: subTrack?.m3u8 || null,
        dub: dubTrack?.m3u8 || null,
        category: track.category,
      }),
      streamUrl: proxiedHlsUrl(origin, track.m3u8),
      originalUrl: track.m3u8,
      server: track.server,
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
  };
};

export default sourcesController;

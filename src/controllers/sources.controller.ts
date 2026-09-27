import { Context } from 'hono';
import { validationError } from '../utils/errors';
import {
  parseThemeServers,
  pickServer,
  resolveMegaPlaySources,
  StreamResult,
} from '../services/megaplay';
import {
  animeSlugFromEpisodeId,
  episodeNumericId,
  fetchTheme,
  htmlFromAjax,
} from '../utils/themeAjax';
import { proxiedHlsUrl, requestOrigin, watchPageUrl } from '../utils/streamUrls';

function withPlayableProxy(c: Context, stream: StreamResult, server: string, category: string) {
  const origin = requestOrigin(c);
  const sources = stream.sources.map((s) => {
    const link = watchPageUrl(origin, s.url);
    return {
      ...s,
      // Browser-openable page (plays in-tab; does not download .m3u8)
      url: link,
      isM3U8: false,
      type: 'link' as const,
      // Raw proxied playlist for VLC/mpv/bots that speak HLS
      streamUrl: proxiedHlsUrl(origin, s.url),
      originalUrl: s.url,
    };
  });

  return {
    ...stream,
    // Top-level share link — open this in a browser
    link: sources[0]?.url || null,
    sources,
    headers: {
      Referer: `${origin}/`,
      'User-Agent': stream.headers['User-Agent'] || stream.headers['user-agent'] || '',
    },
    server,
    category,
  };
}

const sourcesController = async (c: Context) => {
  const animeEpisodeId =
    c.req.query('animeEpisodeId') || c.req.query('episodeId') || c.req.param('episodeId');
  const server = (c.req.query('server') || 'hd-1').toLowerCase();
  const category = (c.req.query('category') || c.req.query('type') || 'sub').toLowerCase();

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
  let picked = pickServer(servers, server, category);

  if (!picked) {
    throw new validationError(`No ${category} server matching "${server}"`, {
      available: servers.map((s) => ({ type: s.type, serverName: s.serverName })),
    });
  }

  if (!/megaplay/i.test(picked.embedUrl)) {
    const megaplayFallback = pickServer(
      servers.filter((s) => /megaplay/i.test(s.embedUrl)),
      'hd-1',
      category
    );
    if (!megaplayFallback) {
      throw new validationError(
        `Server "${picked.serverName}" is not a MegaPlay embed; no stream extractor available`,
        { embedUrl: picked.embedUrl }
      );
    }
    picked = megaplayFallback;
  }

  const stream = await resolveMegaPlaySources(picked.embedUrl);
  return withPlayableProxy(
    c,
    stream,
    picked.serverName.toLowerCase().replace(/\s+/g, '-'),
    category
  );
};

export default sourcesController;

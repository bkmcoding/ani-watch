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
import { proxiedHlsUrl } from './hlsProxy.controller';

function withPlayableProxy(c: Context, stream: StreamResult, server: string, category: string) {
  const origin = new URL(c.req.url).origin;
  return {
    ...stream,
    // Direct CDN URLs need Referer + PNG unwrap — unusable in VLC/mpv as-is.
    // Proxied URLs rewrite playlists and strip the PNG wrapper so normal players work.
    sources: stream.sources.map((s) => ({
      ...s,
      url: proxiedHlsUrl(origin, s.url),
      originalUrl: s.url,
    })),
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
    // Only MegaPlay embeds expose decryptable HLS today (ZokoAnime is a different player).
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

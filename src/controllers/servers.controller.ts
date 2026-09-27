import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { parseThemeServers } from '../services/megaplay';
import {
  animeSlugFromEpisodeId,
  episodeNumericId,
  fetchTheme,
  htmlFromAjax,
} from '../utils/themeAjax';

function mapServers(servers: ReturnType<typeof parseThemeServers>, type: string) {
  return servers
    .filter((s) => s.type === type)
    .map((s) => ({
      serverId: s.serverId,
      serverName: s.serverName.toLowerCase().replace(/\s+/g, '-'),
    }));
}

const serversController = async (c: Context) => {
  const animeEpisodeId =
    c.req.query('animeEpisodeId') || c.req.query('episodeId') || c.req.param('episodeId');

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
  const episodeNo = Number(epNum);

  return {
    episodeId: animeEpisodeId.replace('::', '?'),
    episodeNo: Number.isFinite(episodeNo) ? episodeNo : null,
    sub: mapServers(servers, 'sub'),
    dub: mapServers(servers, 'dub'),
    raw: mapServers(servers, 'raw'),
  };
};

export default serversController;

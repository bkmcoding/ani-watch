import { Context } from 'hono';
import { validationError } from '../../lib/errors';
import { isHd1Server, isHd2Server, parseThemeServers, ThemeServer } from '../../services/megaplay';
import {
  animeSlugFromEpisodeId,
  episodeNumericId,
  fetchTheme,
  htmlFromAjax,
} from '../../lib/themeAjax';
import { scrapeCache } from '../../lib/ttlCache';

const SERVERS_CACHE_TTL_MS = 300_000; // 5 minutes (Spec §2.3)

export interface EnrichedServer {
  serverId: string | number;
  serverName: string;
  label: string;
  provider: string;
  preferred: boolean;
}

function enrichServer(s: ThemeServer): EnrichedServer {
  if (isHd1Server(s)) {
    return {
      serverId: s.serverId,
      serverName: 'hd-1',
      label: 'HD-1 (MegaCloud)',
      provider: 'megaplay',
      preferred: true,
    };
  }
  if (isHd2Server(s)) {
    return {
      serverId: s.serverId,
      serverName: 'hd-2',
      label: 'HD-2 (RapidCloud)',
      provider: 'megaplay',
      preferred: false,
    };
  }
  if (/zoko/i.test(s.embedUrl) || /zoko/i.test(s.serverName)) {
    return {
      serverId: s.serverId,
      serverName: 'zoko',
      label: 'Zoko',
      provider: 'zoko',
      preferred: false,
    };
  }
  if (/gogo/i.test(s.embedUrl) || /gogo/i.test(s.serverName) || /anitaku/i.test(s.embedUrl)) {
    return {
      serverId: s.serverId,
      serverName: 'gogo',
      label: 'Gogo (Backup)',
      provider: 'gogoanime',
      preferred: false,
    };
  }
  return {
    serverId: s.serverId,
    serverName: s.serverName.toLowerCase().replace(/\s+/g, '-'),
    label: s.serverName,
    provider: 'megaplay',
    preferred: false,
  };
}

function mapServers(servers: ThemeServer[], type: string): EnrichedServer[] {
  const filtered = servers.filter(s => s.type === type);
  let hasPreferred = false;

  const mapped = filtered.map(s => {
    const enriched = enrichServer(s);
    if (enriched.preferred) {
      if (hasPreferred) {
        enriched.preferred = false;
      } else {
        hasPreferred = true;
      }
    }
    return enriched;
  });

  if (!hasPreferred && mapped.length > 0) {
    mapped[0].preferred = true;
  }

  // Include GogoAnime fallback server in sub (and dub where applicable)
  // so the client UI has an independent backup option listed.
  if ((type === 'sub' || type === 'dub') && mapped.length > 0) {
    if (!mapped.some(s => s.serverName === 'gogo' || s.provider === 'gogoanime')) {
      mapped.push({
        serverId: 'gogo',
        serverName: 'gogo',
        label: 'Gogo (Backup)',
        provider: 'gogoanime',
        preferred: false,
      });
    }
  }

  return mapped;
}

const serversController = async (c: Context) => {
  const animeEpisodeId =
    c.req.query('animeEpisodeId') || c.req.query('episodeId') || c.req.param('episodeId');

  if (!animeEpisodeId) {
    throw new validationError('animeEpisodeId is required', {
      example: 'one-piece-1?ep=1',
    });
  }

  const normalizedEpisodeId = animeEpisodeId.replace('::', '?');
  const cacheKey = `servers:${normalizedEpisodeId}`;
  const cached = scrapeCache.get(cacheKey) as
    | {
        episodeId: string;
        episodeNo: number | null;
        sub: EnrichedServer[];
        dub: EnrichedServer[];
        raw: EnrichedServer[];
      }
    | undefined;
  if (cached) {
    return cached;
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

  const payload = {
    episodeId: normalizedEpisodeId,
    episodeNo: Number.isFinite(episodeNo) ? episodeNo : null,
    sub: mapServers(servers, 'sub'),
    dub: mapServers(servers, 'dub'),
    raw: mapServers(servers, 'raw'),
  };

  scrapeCache.set(cacheKey, payload, SERVERS_CACHE_TTL_MS);
  return payload;
};

export default serversController;

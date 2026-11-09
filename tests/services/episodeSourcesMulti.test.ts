import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as megaModule from '../../src/services/megaplay';
import * as zokoModule from '../../src/services/zoko';
import * as gogoModule from '../../src/services/gogoanime';
import {
  resolveCategory,
  resolveEpisodePlayback,
  buildAvailableProviders,
  serverLabel,
  ProviderId,
} from '../../src/services/episodeSources';
import * as themeAjaxModule from '../../src/lib/themeAjax';
import { scrapeCache } from '../../src/lib/ttlCache';

describe('Tri-Provider Routing & Cache Partitioning (episodeSources)', () => {
  const mockServers = [
    {
      type: 'sub',
      serverName: 'HD-1',
      serverId: 1,
      embedUrl: 'https://megacloud.blog/embed-2/e-1?k=1',
    },
    {
      type: 'sub',
      serverName: 'HD-2',
      serverId: 2,
      embedUrl: 'https://rapid-cloud.co/embed-2/e-1?k=1',
    },
    {
      type: 'sub',
      serverName: 'Zoko',
      serverId: 3,
      embedUrl: 'https://zokoanime.video/embed/v1',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Distinct Server Routing (hd-1 vs hd-2 vs zoko vs gogo)', () => {
    it('resolves hd-1 and hd-2 to distinct server results', async () => {
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockImplementation(async (url: string) => {
        if (url.includes('megacloud')) {
          return {
            headers: { Referer: 'https://megacloud.blog/' },
            sources: [{ url: 'https://cdn.megacloud.blog/hd1.m3u8', isM3U8: true }],
            subtitles: [],
            intro: null,
            outro: null,
            anilistID: null,
            malID: null,
          };
        }
        return {
          headers: { Referer: 'https://rapid-cloud.co/' },
          sources: [{ url: 'https://cdn.rapid-cloud.co/hd2.m3u8', isM3U8: true }],
          subtitles: [],
          intro: null,
          outro: null,
          anilistID: null,
          malID: null,
        };
      });

      const resHd1 = await resolveCategory(
        mockServers,
        'sub',
        'hd-1',
        'anime-test-ep-1',
        'Anime Test'
      );
      const resHd2 = await resolveCategory(
        mockServers,
        'sub',
        'hd-2',
        'anime-test-ep-1',
        'Anime Test'
      );

      expect(resHd1).not.toBeNull();
      expect(resHd1?.provider).toBe('megaplay');
      expect(resHd1?.server).toBe('hd-1');
      expect(resHd1?.m3u8).toBe('https://cdn.megacloud.blog/hd1.m3u8');

      expect(resHd2).not.toBeNull();
      expect(resHd2?.provider).toBe('megaplay');
      expect(resHd2?.server).toBe('hd-2');
      expect(resHd2?.m3u8).toBe('https://cdn.rapid-cloud.co/hd2.m3u8');
    });

    it('resolves zoko directly when server is zoko', async () => {
      vi.spyOn(zokoModule, 'resolveZokoSources').mockResolvedValueOnce({
        headers: { Referer: 'https://zokoanime.video/' },
        sources: [{ url: 'https://cdn.zokoanime.video/zoko-stream.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });
      const megaSpy = vi.spyOn(megaModule, 'resolveMegaPlaySources');

      const res = await resolveCategory(
        mockServers,
        'sub',
        'zoko',
        'anime-test-ep-2',
        'Anime Test'
      );

      expect(res).not.toBeNull();
      expect(res?.provider).toBe('zoko');
      expect(res?.server).toBe('zoko');
      expect(res?.m3u8).toBe('https://cdn.zokoanime.video/zoko-stream.m3u8');
      expect(megaSpy).not.toHaveBeenCalled();
    });

    it('resolves gogo directly when server is gogo', async () => {
      const gogoSpy = vi.spyOn(gogoModule, 'resolveGogoSources').mockResolvedValueOnce({
        headers: { Referer: 'https://anitaku.to/' },
        sources: [{ url: 'https://cdn.gogocdn.net/gogo-stream.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });
      const megaSpy = vi.spyOn(megaModule, 'resolveMegaPlaySources');
      const zokoSpy = vi.spyOn(zokoModule, 'resolveZokoSources');

      const res = await resolveCategory(
        mockServers,
        'sub',
        'gogo',
        'one-piece-100?ep=100',
        'One Piece'
      );

      expect(res).not.toBeNull();
      expect(res?.provider).toBe('gogoanime');
      expect(res?.server).toBe('gogo');
      expect(res?.m3u8).toBe('https://cdn.gogocdn.net/gogo-stream.m3u8');
      expect(gogoSpy).toHaveBeenCalledWith('One Piece', '100');
      expect(megaSpy).not.toHaveBeenCalled();
      expect(zokoSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cache Partitioning by Server', () => {
    it('isolates cache entries per server identifier', async () => {
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockImplementation(async (url: string) => {
        if (url.includes('megacloud')) {
          return {
            headers: { Referer: 'https://megacloud.blog/' },
            sources: [{ url: 'https://cdn.megacloud.blog/cached-hd1.m3u8', isM3U8: true }],
            subtitles: [],
            intro: null,
            outro: null,
            anilistID: null,
            malID: null,
          };
        }
        return {
          headers: { Referer: 'https://rapid-cloud.co/' },
          sources: [{ url: 'https://cdn.rapid-cloud.co/cached-hd2.m3u8', isM3U8: true }],
          subtitles: [],
          intro: null,
          outro: null,
          anilistID: null,
          malID: null,
        };
      });

      const epId = 'cache-isolate-ep-1';
      await resolveCategory(mockServers, 'sub', 'hd-1', epId, 'Cache Anime');

      expect(scrapeCache.get(`stream:${epId}:sub:hd-1`)).toBeDefined();
      expect(scrapeCache.get(`stream:${epId}:sub:hd-2`)).toBeUndefined();

      await resolveCategory(mockServers, 'sub', 'hd-2', epId, 'Cache Anime');
      expect(scrapeCache.get(`stream:${epId}:sub:hd-2`)).toBeDefined();
    });
  });

  describe('Multi-Tier Dynamic Fallback Chain', () => {
    it('falls back from hd-1 -> hd-2 when hd-1 throws error', async () => {
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockImplementation(async (url: string) => {
        if (url.includes('megacloud')) {
          throw new Error('MegaCloud HD-1 403 Forbidden');
        }
        return {
          headers: { Referer: 'https://rapid-cloud.co/' },
          sources: [{ url: 'https://cdn.rapid-cloud.co/failover-hd2.m3u8', isM3U8: true }],
          subtitles: [],
          intro: null,
          outro: null,
          anilistID: null,
          malID: null,
        };
      });

      const res = await resolveCategory(mockServers, 'sub', 'hd-1', 'failover-ep-1', 'Test Anime');
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('megaplay');
      expect(res?.server).toBe('hd-2');
      expect(res?.m3u8).toBe('https://cdn.rapid-cloud.co/failover-hd2.m3u8');
    });

    it('falls back from hd-1 -> zoko when both hd-1 and hd-2 fail', async () => {
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockRejectedValue(
        new Error('All MegaPlay servers down')
      );
      vi.spyOn(zokoModule, 'resolveZokoSources').mockResolvedValueOnce({
        headers: { Referer: 'https://zokoanime.video/' },
        sources: [{ url: 'https://cdn.zokoanime.video/fallback-zoko.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const res = await resolveCategory(mockServers, 'sub', 'hd-1', 'failover-ep-2', 'Test Anime');
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('zoko');
      expect(res?.m3u8).toBe('https://cdn.zokoanime.video/fallback-zoko.m3u8');
    });

    it('falls back from hd-1 -> gogo when hd-1, hd-2, and zoko all fail', async () => {
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockRejectedValue(
        new Error('MegaPlay 500 error')
      );
      vi.spyOn(zokoModule, 'resolveZokoSources').mockRejectedValue(new Error('Zoko 500 error'));
      vi.spyOn(gogoModule, 'resolveGogoSources').mockResolvedValueOnce({
        headers: { Referer: 'https://anitaku.to/' },
        sources: [{ url: 'https://cdn.gogocdn.net/fallback-gogo.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const res = await resolveCategory(mockServers, 'sub', 'hd-1', 'naruto-1?ep=5', 'Naruto');
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('gogoanime');
      expect(res?.server).toBe('gogo');
      expect(res?.m3u8).toBe('https://cdn.gogocdn.net/fallback-gogo.m3u8');
    });

    it('falls back from gogo -> hd-1 -> hd-2 -> zoko when gogo fails', async () => {
      vi.spyOn(gogoModule, 'resolveGogoSources').mockResolvedValueOnce(null);
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockResolvedValueOnce({
        headers: { Referer: 'https://megacloud.blog/' },
        sources: [{ url: 'https://cdn.megacloud.blog/gogo-fallback-hd1.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const res = await resolveCategory(mockServers, 'sub', 'gogo', 'bleach-1?ep=1', 'Bleach');
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('megaplay');
      expect(res?.server).toBe('hd-1');
      expect(res?.m3u8).toBe('https://cdn.megacloud.blog/gogo-fallback-hd1.m3u8');
    });

    it('falls back from hd-2 -> hd-1 when hd-2 throws error', async () => {
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockImplementation(async (url: string) => {
        if (url.includes('rapid-cloud')) {
          throw new Error('RapidCloud HD-2 error');
        }
        return {
          headers: { Referer: 'https://megacloud.blog/' },
          sources: [{ url: 'https://cdn.megacloud.blog/hd1-from-hd2-fallback.m3u8', isM3U8: true }],
          subtitles: [],
          intro: null,
          outro: null,
          anilistID: null,
          malID: null,
        };
      });

      const res = await resolveCategory(mockServers, 'sub', 'hd-2', 'hd2-fallback-ep', 'HD2 Test');
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('megaplay');
      expect(res?.server).toBe('hd-1');
      expect(res?.m3u8).toBe('https://cdn.megacloud.blog/hd1-from-hd2-fallback.m3u8');
    });

    it('falls back from zoko -> hd-1 when zoko throws error', async () => {
      vi.spyOn(zokoModule, 'resolveZokoSources').mockRejectedValueOnce(
        new Error('Zoko player down')
      );
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockResolvedValueOnce({
        headers: { Referer: 'https://megacloud.blog/' },
        sources: [{ url: 'https://cdn.megacloud.blog/zoko-fallback-hd1.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const res = await resolveCategory(
        mockServers,
        'sub',
        'zoko',
        'zoko-fallback-ep',
        'Zoko Test'
      );
      expect(res).not.toBeNull();
      expect(res?.provider).toBe('megaplay');
      expect(res?.server).toBe('hd-1');
      expect(res?.m3u8).toBe('https://cdn.megacloud.blog/zoko-fallback-hd1.m3u8');
    });

    it('returns null and does not cache null when all providers fail', async () => {
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockRejectedValue(new Error('Mega down'));
      vi.spyOn(zokoModule, 'resolveZokoSources').mockRejectedValue(new Error('Zoko down'));
      vi.spyOn(gogoModule, 'resolveGogoSources').mockResolvedValueOnce(null);

      const epId = 'all-fail-ep';
      const res = await resolveCategory(mockServers, 'sub', 'hd-1', epId, 'Fail Anime');
      expect(res).toBeNull();
      expect(scrapeCache.get(`stream:${epId}:sub:hd-1`)).toBeUndefined();
    });
  });

  describe('buildAvailableProviders & Metadata', () => {
    it('includes gogoanime in available providers', () => {
      const providers = buildAvailableProviders(mockServers, ['sub']);
      const ids = providers.map(p => p.id);
      expect(ids).toContain('megaplay');
      expect(ids).toContain('zoko');
      expect(ids).toContain('gogoanime');

      const gogoMeta = providers.find(p => p.id === 'gogoanime');
      expect(gogoMeta?.label).toBe('GogoAnime');
      expect(gogoMeta?.preferred).toBe(false);
      expect(gogoMeta?.capabilities.introOutro).toBe(false);
      expect(gogoMeta?.capabilities.softsubs).toBe(false);
    });

    it('serverLabel formats friendly labels for servers', () => {
      expect(serverLabel('hd-1')).toBe('HD-1');
      expect(serverLabel('hd-2')).toBe('HD-2');
      expect(serverLabel('zoko')).toBe('Zoko');
      expect(serverLabel('gogo')).toBe('GogoAnime');
      expect(serverLabel('megacloud')).toBe('HD-1');
      expect(serverLabel('rapidcloud')).toBe('HD-2');
    });
  });

  describe('resolveEpisodePlayback Integration', () => {
    it('returns active server and serverLabel in EpisodePlayback', async () => {
      const mockAjaxResponse = {
        success: true,
        data: JSON.stringify({
          html: '<div class="server-item" data-type="sub" data-hash="aHR0cHM6Ly9tZWdhY2xvdWQuYmxvZy9lbWJlZC0yL2UtMT9rPTE=" data-server-name="HD-1">HD-1</div>',
        }),
      };

      vi.spyOn(themeAjaxModule, 'fetchTheme').mockResolvedValue(mockAjaxResponse as any);
      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockResolvedValueOnce({
        headers: { Referer: 'https://megacloud.blog/' },
        sources: [{ url: 'https://cdn.megacloud.blog/playback.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const playback = await resolveEpisodePlayback('https://aniwatch.to', 'one-piece-100?ep=100', {
        server: 'hd-1',
        category: 'sub',
        nav: false,
      });

      expect(playback.server).toBe('hd-1');
      expect(playback.serverLabel).toBe('HD-1');
      expect(playback.provider).toBe('megaplay');
      expect(playback.providerLabel).toBe('MegaPlay');
      expect(playback.animeTitle).toBe('One Piece');
    });
  });
});

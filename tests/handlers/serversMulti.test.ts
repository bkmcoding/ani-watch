import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import * as themeAjaxModule from '../../src/lib/themeAjax';
import * as megaModule from '../../src/services/megaplay';
import * as zokoModule from '../../src/services/zoko';

describe('Enriched Servers & Sources Endpoints (Multi-Provider Resilience)', () => {
  const mockServersHtml = `
    <div class="server-item" data-type="sub" data-hash="aHR0cHM6Ly9tZWdhY2xvdWQuYmxvZy9lbWJlZC0yL2UtMT9rPTE=" data-server-name="HD-1">HD-1</div>
    <div class="server-item" data-type="sub" data-hash="aHR0cHM6Ly9yYXBpZC1jbG91ZC5jby9lbWJlZC0yL2UtMT9rPTE=" data-server-name="HD-2">HD-2</div>
    <div class="server-item" data-type="sub" data-hash="aHR0cHM6Ly96b2tvYW5pbWUudmlkZW8vZW1iZWQvdjE=" data-server-name="Zoko">Zoko</div>
    <div class="server-item" data-type="dub" data-hash="aHR0cHM6Ly9tZWdhY2xvdWQuYmxvZy9lbWJlZC0yL2UtMT9rPTE=" data-server-name="HD-1">HD-1</div>
    <div class="server-item" data-type="dub" data-hash="aHR0cHM6Ly9yYXBpZC1jbG91ZC5jby9lbWJlZC0yL2UtMT9rPTE=" data-server-name="HD-2">HD-2</div>
  `;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v2/hianime/episode/servers', () => {
    it('returns enriched server metadata with label, provider, preferred, and gogo fallback', async () => {
      vi.spyOn(themeAjaxModule, 'fetchTheme').mockResolvedValue({
        success: true,
        data: JSON.stringify({ html: mockServersHtml }),
      } as any);

      const res = await app.request('/api/v2/hianime/episode/servers?animeEpisodeId=naruto-shippuden-100?ep=100');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.episodeId).toBe('naruto-shippuden-100?ep=100');
      expect(body.data.episodeNo).toBe(100);

      // Verify sub servers
      const sub = body.data.sub;
      expect(Array.isArray(sub)).toBe(true);
      expect(sub.length).toBe(4); // HD-1, HD-2, Zoko, and Gogo fallback

      const hd1 = sub.find((s: any) => s.serverName === 'hd-1');
      expect(hd1).toMatchObject({
        serverId: 1,
        serverName: 'hd-1',
        label: 'HD-1 (MegaCloud)',
        provider: 'megaplay',
        preferred: true,
      });

      const hd2 = sub.find((s: any) => s.serverName === 'hd-2');
      expect(hd2).toMatchObject({
        serverId: 2,
        serverName: 'hd-2',
        label: 'HD-2 (RapidCloud)',
        provider: 'megaplay',
        preferred: false,
      });

      const zoko = sub.find((s: any) => s.serverName === 'zoko');
      expect(zoko).toMatchObject({
        serverId: 3,
        serverName: 'zoko',
        label: 'Zoko',
        provider: 'zoko',
        preferred: false,
      });

      const gogoSub = sub.find((s: any) => s.serverName === 'gogo');
      expect(gogoSub).toMatchObject({
        serverId: 'gogo',
        serverName: 'gogo',
        label: 'Gogo (Backup)',
        provider: 'gogoanime',
        preferred: false,
      });

      // Verify dub servers include gogo fallback when dub exists
      const dub = body.data.dub;
      expect(Array.isArray(dub)).toBe(true);
      expect(dub.length).toBe(3); // HD-1, HD-2, and Gogo fallback
      const gogoDub = dub.find((s: any) => s.serverName === 'gogo');
      expect(gogoDub).toMatchObject({
        serverId: 'gogo',
        serverName: 'gogo',
        label: 'Gogo (Backup)',
        provider: 'gogoanime',
        preferred: false,
      });

      // Raw servers should be an array
      expect(Array.isArray(body.data.raw)).toBe(true);
    });

    it('does not append gogo fallback to dub if dub has no servers', async () => {
      const subOnlyHtml = `
        <div class="server-item" data-type="sub" data-hash="aHR0cHM6Ly9tZWdhY2xvdWQuYmxvZy9lbWJlZC0yL2UtMT9rPTE=" data-server-name="HD-1">HD-1</div>
      `;
      vi.spyOn(themeAjaxModule, 'fetchTheme').mockResolvedValue({
        success: true,
        data: JSON.stringify({ html: subOnlyHtml }),
      } as any);

      const res = await app.request('/api/v2/hianime/episode/servers?animeEpisodeId=sub-only-100?ep=100');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.sub.length).toBe(2); // HD-1 + Gogo
      expect(body.data.dub.length).toBe(0); // Dub stays empty
    });

    it('returns 400 when animeEpisodeId is missing', async () => {
      const res = await app.request('/api/v2/hianime/episode/servers');
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('animeEpisodeId is required');
    });

    it('caches server list responses with servers:${episodeId} key', async () => {
      const fetchSpy = vi.spyOn(themeAjaxModule, 'fetchTheme').mockResolvedValue({
        success: true,
        data: JSON.stringify({ html: mockServersHtml }),
      } as any);

      const epId = 'cache-test-servers-100?ep=100';
      const res1 = await app.request(`/api/v2/hianime/episode/servers?animeEpisodeId=${epId}`);
      expect(res1.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call hits cache without calling fetchTheme again
      const res2 = await app.request(`/api/v2/hianime/episode/servers?animeEpisodeId=${epId}`);
      expect(res2.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/v2/hianime/episode/sources', () => {
    it('accepts server=hd-2 and returns server: "hd-2", serverLabel, and availableProviders', async () => {
      vi.spyOn(themeAjaxModule, 'fetchTheme').mockImplementation(async (path: string) => {
        if (path.startsWith('episode/list')) {
          return { success: true, data: JSON.stringify({ html: '' }) } as any;
        }
        return {
          success: true,
          data: JSON.stringify({ html: mockServersHtml }),
        } as any;
      });

      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockImplementation(async (url: string) => {
        if (url.includes('rapid-cloud')) {
          return {
            headers: { Referer: 'https://rapid-cloud.co/' },
            sources: [{ url: 'https://cdn.rapid-cloud.co/hd2.m3u8', isM3U8: true }],
            subtitles: [],
            intro: null,
            outro: null,
            anilistID: null,
            malID: null,
          };
        }
        return {
          headers: { Referer: 'https://megacloud.blog/' },
          sources: [{ url: 'https://cdn.megacloud.blog/hd1.m3u8', isM3U8: true }],
          subtitles: [],
          intro: null,
          outro: null,
          anilistID: null,
          malID: null,
        };
      });

      const res = await app.request(
        '/api/v2/hianime/episode/sources?animeEpisodeId=bleach-50?ep=50&server=hd-2&category=sub'
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.server).toBe('hd-2');
      expect(body.data.serverLabel).toBe('HD-2');
      expect(Array.isArray(body.data.availableProviders)).toBe(true);
      expect(body.data.availableProviders.some((p: any) => p.id === 'megaplay')).toBe(true);
      expect(body.data.availableProviders.some((p: any) => p.id === 'gogoanime')).toBe(true);
    });

    it('accepts server=zoko and resolves via zoko provider', async () => {
      vi.spyOn(themeAjaxModule, 'fetchTheme').mockImplementation(async (path: string) => {
        if (path.startsWith('episode/list')) {
          return { success: true, data: JSON.stringify({ html: '' }) } as any;
        }
        return {
          success: true,
          data: JSON.stringify({ html: mockServersHtml }),
        } as any;
      });

      vi.spyOn(zokoModule, 'resolveZokoSources').mockResolvedValue({
        headers: { Referer: 'https://zokoanime.video/' },
        sources: [{ url: 'https://cdn.zokoanime.video/stream.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockResolvedValue({
        headers: { Referer: 'https://megacloud.blog/' },
        sources: [{ url: 'https://cdn.megacloud.blog/hd1.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const res = await app.request(
        '/api/v2/hianime/episode/sources?animeEpisodeId=zoko-test-1?ep=1&server=zoko&category=sub'
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.server).toBe('zoko');
      expect(body.data.serverLabel).toBe('Zoko');
      expect(body.data.provider).toBe('zoko');
    });

    it('returns 400 when animeEpisodeId is missing', async () => {
      const res = await app.request('/api/v2/hianime/episode/sources');
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('animeEpisodeId is required');
    });
  });

  describe('GET /api/v2/hianime/watch/play', () => {
    it('preserves server parameter in the 302 redirect location header for hd-2', async () => {
      vi.spyOn(themeAjaxModule, 'fetchTheme').mockImplementation(async (path: string) => {
        if (path.startsWith('episode/list')) {
          return { success: true, data: JSON.stringify({ html: '' }) } as any;
        }
        return {
          success: true,
          data: JSON.stringify({ html: mockServersHtml }),
        } as any;
      });

      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockResolvedValue({
        headers: { Referer: 'https://rapid-cloud.co/' },
        sources: [{ url: 'https://cdn.rapid-cloud.co/hd2.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const res = await app.request(
        '/api/v2/hianime/watch/play?animeEpisodeId=one-piece-100?ep=100&server=hd-2&category=sub'
      );
      expect(res.status).toBe(302);

      const location = res.headers.get('location');
      expect(location).not.toBeNull();
      expect(location).toContain('/api/v2/hianime/watch?');
      expect(location).toContain('server=hd-2');
    });

    it('preserves server parameter in the 302 redirect location header for zoko', async () => {
      vi.spyOn(themeAjaxModule, 'fetchTheme').mockImplementation(async (path: string) => {
        if (path.startsWith('episode/list')) {
          return { success: true, data: JSON.stringify({ html: '' }) } as any;
        }
        return {
          success: true,
          data: JSON.stringify({ html: mockServersHtml }),
        } as any;
      });

      vi.spyOn(zokoModule, 'resolveZokoSources').mockResolvedValue({
        headers: { Referer: 'https://zokoanime.video/' },
        sources: [{ url: 'https://cdn.zokoanime.video/stream.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      vi.spyOn(megaModule, 'resolveMegaPlaySources').mockResolvedValue({
        headers: { Referer: 'https://megacloud.blog/' },
        sources: [{ url: 'https://cdn.megacloud.blog/hd1.m3u8', isM3U8: true }],
        subtitles: [],
        intro: null,
        outro: null,
        anilistID: null,
        malID: null,
      });

      const res = await app.request(
        '/api/v2/hianime/watch/play?animeEpisodeId=one-piece-100?ep=100&server=zoko&category=sub'
      );
      expect(res.status).toBe(302);

      const location = res.headers.get('location');
      expect(location).not.toBeNull();
      expect(location).toContain('server=zoko');
    });

    it('returns 400 when animeEpisodeId is missing', async () => {
      const res = await app.request('/api/v2/hianime/watch/play');
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('animeEpisodeId is required');
    });
  });
});

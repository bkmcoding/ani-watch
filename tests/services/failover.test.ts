import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as megaModule from '../../src/services/megaplay';
import * as zokoModule from '../../src/services/zoko';
import { resolveCategory } from '../../src/services/episodeSources';
import { scrapeCache } from '../../src/lib/ttlCache';

describe('Provider Auto-Failover (MegaPlay <-> Zoko)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockServers = [
    {
      type: 'sub',
      serverName: 'HD-1',
      serverId: 1,
      embedUrl: 'https://megacloud.blog/embed-2/e-1',
    },
    {
      type: 'sub',
      serverName: 'Zoko',
      serverId: 2,
      embedUrl: 'https://zokoanime.video/embed/v1',
    },
  ];

  it('uses MegaPlay by default when MegaPlay succeeds', async () => {
    vi.spyOn(megaModule, 'resolveMegaPlaySources').mockResolvedValueOnce({
      headers: { Referer: 'https://megacloud.blog/' },
      sources: [{ url: 'https://cdn.megacloud.blog/sub.m3u8', isM3U8: true }],
      subtitles: [],
      intro: null,
      outro: null,
      anilistID: null,
      malID: null,
    });

    const res = await resolveCategory(mockServers, 'sub', 'hd-1', 'test-ep-1');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('megaplay');
    expect(res?.m3u8).toBe('https://cdn.megacloud.blog/sub.m3u8');
  });

  it('automatically fails over to Zoko when MegaPlay throws an error', async () => {
    vi.spyOn(megaModule, 'resolveMegaPlaySources').mockRejectedValueOnce(
      new Error('MegaPlay 403 Forbidden / Cloudflare challenge')
    );
    vi.spyOn(zokoModule, 'resolveZokoSources').mockResolvedValueOnce({
      headers: { Referer: 'https://zokoanime.video/' },
      sources: [{ url: 'https://cdn.zokoanime.video/zoko-sub.m3u8', isM3U8: true }],
      subtitles: [],
      intro: null,
      outro: null,
      anilistID: null,
      malID: null,
    });

    const res = await resolveCategory(mockServers, 'sub', 'hd-1', 'test-ep-2');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('zoko');
    expect(res?.m3u8).toBe('https://cdn.zokoanime.video/zoko-sub.m3u8');
  });

  it('attempts Zoko first when server query specifies zoko', async () => {
    const zokoSpy = vi.spyOn(zokoModule, 'resolveZokoSources').mockResolvedValueOnce({
      headers: { Referer: 'https://zokoanime.video/' },
      sources: [{ url: 'https://cdn.zokoanime.video/primary-zoko.m3u8', isM3U8: true }],
      subtitles: [],
      intro: null,
      outro: null,
      anilistID: null,
      malID: null,
    });
    const megaSpy = vi.spyOn(megaModule, 'resolveMegaPlaySources');

    const res = await resolveCategory(mockServers, 'sub', 'zoko', 'test-ep-3');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('zoko');
    expect(zokoSpy).toHaveBeenCalledTimes(1);
    expect(megaSpy).not.toHaveBeenCalled();
  });

  it('does not cache null when all providers fail', async () => {
    vi.spyOn(megaModule, 'resolveMegaPlaySources').mockRejectedValueOnce(
      new Error('MegaPlay network error')
    );
    vi.spyOn(zokoModule, 'resolveZokoSources').mockRejectedValueOnce(
      new Error('Zoko network error')
    );

    const epId = 'test-ep-fail-nocache';
    const res = await resolveCategory(mockServers, 'sub', 'hd-1', epId);
    expect(res).toBeNull();

    // Verify cacheKey was NOT stored with null
    const cacheKey = `stream:${epId}:sub:hd-1`;
    expect(scrapeCache.get(cacheKey)).toBeUndefined();
  });
});

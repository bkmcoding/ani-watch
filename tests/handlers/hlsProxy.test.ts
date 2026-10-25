import { describe, expect, it, vi } from 'vitest';
import {
  isSubtitleUrl,
  rewritePlaylist,
  fetchPlaylistCoalesced,
} from '../../src/handlers/media/hlsProxy';

describe('hlsProxy Media Rewriting & Parity', () => {
  it('correctly identifies subtitle URLs', () => {
    expect(isSubtitleUrl('https://cdn.example.com/sub/track.vtt')).toBe(true);
    expect(isSubtitleUrl('https://cdn.example.com/sub/track.vtt?token=xyz')).toBe(true);
    expect(isSubtitleUrl('https://cdn.example.com/sub/track.ass')).toBe(true);
    expect(isSubtitleUrl('https://cdn.example.com/sub/track.ssa')).toBe(true);

    expect(isSubtitleUrl('https://cdn.example.com/video/ep1.m3u8')).toBe(false);
    expect(isSubtitleUrl('https://cdn.example.com/video/seg-001.ts')).toBe(false);
    expect(isSubtitleUrl('https://cdn.example.com/video/video.mp4')).toBe(false);
  });

  it('rewrites EXT-X-MEDIA:TYPE=SUBTITLES URIs to the VTT proxy', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="en",URI="english.vtt"',
      '#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=1280x720,SUBTITLES="subs"',
      '720p.m3u8',
    ].join('\n');

    const playlistUrl = 'https://cdn.example.com/master.m3u8';
    const proxyBase = 'https://media.aniwatch.me/hls';
    const vttBase = 'https://media.aniwatch.me/vtt';

    const rewritten = rewritePlaylist(playlist, playlistUrl, proxyBase, vttBase);

    // Subtitle URI must point to vttBase
    expect(rewritten).toContain(
      'URI="https://media.aniwatch.me/vtt?url=https%3A%2F%2Fcdn.example.com%2Fenglish.vtt"'
    );

    // Video stream variant line must point to proxyBase (/hls)
    expect(rewritten).toContain(
      'https://media.aniwatch.me/hls?url=https%3A%2F%2Fcdn.example.com%2F720p.m3u8'
    );
  });

  it('rewrites plain media segments to proxyBase and subtitle segments to vttBase', () => {
    const mediaPlaylist = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:10',
      '#EXTINF:9.009,',
      'segment-001.ts',
      '#EXTINF:9.009,',
      'segment-002.ts',
    ].join('\n');

    const playlistUrl = 'https://cdn.example.com/video/media.m3u8';
    const proxyBase = 'https://media.aniwatch.me/hls';
    const vttBase = 'https://media.aniwatch.me/vtt';

    const rewritten = rewritePlaylist(mediaPlaylist, playlistUrl, proxyBase, vttBase);

    expect(rewritten).toContain(
      'https://media.aniwatch.me/hls?url=https%3A%2F%2Fcdn.example.com%2Fvideo%2Fsegment-001.ts'
    );
    expect(rewritten).toContain(
      'https://media.aniwatch.me/hls?url=https%3A%2F%2Fcdn.example.com%2Fvideo%2Fsegment-002.ts'
    );
  });

  it('coalesces concurrent requests for the same playlist into a single upstream fetch', async () => {
    let fetchCount = 0;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      // Simulate network delay
      await new Promise(r => setTimeout(r, 20));
      return {
        ok: true,
        status: 200,
        text: async () => '#EXTM3U\n#EXT-X-VERSION:3',
      };
    }) as unknown as typeof fetch;

    try {
      const targetUrl = 'https://cdn.example.com/shared-test-playlist.m3u8';
      const headers = { 'User-Agent': 'Test' };

      // Fire 3 concurrent requests simultaneously
      const [res1, res2, res3] = await Promise.all([
        fetchPlaylistCoalesced(targetUrl, headers),
        fetchPlaylistCoalesced(targetUrl, headers),
        fetchPlaylistCoalesced(targetUrl, headers),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      expect(res3.ok).toBe(true);
      expect(res1.text).toBe('#EXTM3U\n#EXT-X-VERSION:3');

      // Crucial assertion: Upstream fetch must only be called ONCE due to in-flight coalescing
      expect(fetchCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

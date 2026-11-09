import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractGogoSourcesFromEmbed,
  extractGogoStreamingIframe,
  formatGogoEpisodeUrl,
  formatGogoSlug,
  GogoStreamResult,
  resolveGogoSources,
} from '../../src/services/gogoanime';

describe('GogoAnime Fallback Scraper Service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('formatGogoSlug', () => {
    it('normalizes basic titles to lowercase hyphenated slugs', () => {
      expect(formatGogoSlug('One Piece')).toBe('one-piece');
      expect(formatGogoSlug('Naruto Shippuden')).toBe('naruto-shippuden');
      expect(formatGogoSlug('Bleach')).toBe('bleach');
    });

    it('removes apostrophes and normalizes colons', () => {
      expect(formatGogoSlug("Frieren: Beyond Journey's End")).toBe('frieren-beyond-journeys-end');
      expect(formatGogoSlug("Komi Can't Communicate")).toBe('komi-cant-communicate');
      expect(formatGogoSlug("JoJo's Bizarre Adventure")).toBe('jojos-bizarre-adventure');
    });

    it('handles numbers and punctuation', () => {
      expect(formatGogoSlug('Mob Psycho 100 II')).toBe('mob-psycho-100-ii');
      expect(formatGogoSlug('Steins;Gate 0')).toBe('steins-gate-0');
      expect(formatGogoSlug('Attack on Titan: The Final Season - Part 3')).toBe(
        'attack-on-titan-the-final-season-part-3'
      );
    });

    it('trims leading/trailing special characters and excess hyphens', () => {
      expect(formatGogoSlug('  !SPY x FAMILY... Part 2?  ')).toBe('spy-x-family-part-2');
      expect(formatGogoSlug('---Chainsaw Man---')).toBe('chainsaw-man');
    });

    it('returns empty string for empty or whitespace-only inputs', () => {
      expect(formatGogoSlug('')).toBe('');
      expect(formatGogoSlug('   ')).toBe('');
    });
  });

  describe('formatGogoEpisodeUrl', () => {
    it('formats standard episode URL path from slug and episode number', () => {
      expect(formatGogoEpisodeUrl('one-piece', 1)).toBe('/one-piece-episode-1');
      expect(formatGogoEpisodeUrl('frieren-beyond-journeys-end', 28)).toBe(
        '/frieren-beyond-journeys-end-episode-28'
      );
    });

    it('handles string episode numbers', () => {
      expect(formatGogoEpisodeUrl('one-piece', '1000')).toBe('/one-piece-episode-1000');
      expect(formatGogoEpisodeUrl('jojos-bizarre-adventure', '12.5')).toBe(
        '/jojos-bizarre-adventure-episode-12.5'
      );
    });

    it('strips leading or trailing slashes in the provided slug', () => {
      expect(formatGogoEpisodeUrl('/naruto-shippuden/', 50)).toBe('/naruto-shippuden-episode-50');
    });
  });

  describe('extractGogoStreamingIframe', () => {
    it('extracts streaming iframe URL from standard .play-video container', () => {
      const html = `
        <div class="anime_video_body">
          <div class="play-video">
            <iframe src="//embtaku.pro/streaming.php?id=MTE5OTU4&title=Frieren" allowfullscreen="true" frameborder="0"></iframe>
          </div>
        </div>
      `;
      const iframeUrl = extractGogoStreamingIframe(html);
      expect(iframeUrl).toBe('https://embtaku.pro/streaming.php?id=MTE5OTU4&title=Frieren');
    });

    it('extracts streaming iframe URL from vidstreaming / embtaku mirror markup', () => {
      const html = `
        <div class="anime_muti_link">
          <iframe src="https://vidstreaming.io/streaming.php?id=NzY1NA=="></iframe>
        </div>
      `;
      const iframeUrl = extractGogoStreamingIframe(html);
      expect(iframeUrl).toBe('https://vidstreaming.io/streaming.php?id=NzY1NA==');
    });

    it('returns null when no valid streaming iframe is present in HTML', () => {
      const html = `
        <div class="anime_video_body">
          <p>Episode is currently unavailable.</p>
        </div>
      `;
      expect(extractGogoStreamingIframe(html)).toBeNull();
    });

    it('returns null for empty or non-string input', () => {
      expect(extractGogoStreamingIframe('')).toBeNull();
      // @ts-expect-error testing invalid input
      expect(extractGogoStreamingIframe(null)).toBeNull();
    });
  });

  describe('extractGogoSourcesFromEmbed', () => {
    it('resolves direct m3u8 sources and subtitles from jwplayer script setup', async () => {
      const mockEmbedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            const player = jwplayer("player").setup({
              sources: [
                { file: "https://gogocdn.stream/hls/frieren/ep.1/master.m3u8", label: "auto", type: "hls" }
              ],
              tracks: [
                { file: "https://gogocdn.stream/sub/frieren/ep.1.vtt", kind: "captions", label: "English", default: true }
              ]
            });
          </script>
        </head>
        <body><div id="player"></div></body>
        </html>
      `;

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockEmbedHtml,
      } as Response);

      const result = await extractGogoSourcesFromEmbed('https://embtaku.pro/streaming.php?id=123');

      expect(result).not.toBeNull();
      expect(result?.headers.Referer).toBe('https://embtaku.pro/streaming.php?id=123');
      expect(result?.headers['User-Agent']).toBeDefined();
      expect(result?.sources).toEqual([
        {
          url: 'https://gogocdn.stream/hls/frieren/ep.1/master.m3u8',
          isM3U8: true,
          quality: 'auto',
        },
      ]);
      expect(result?.subtitles).toEqual([
        {
          lang: 'English',
          url: 'https://gogocdn.stream/sub/frieren/ep.1.vtt',
          default: true,
        },
      ]);
      expect(result?.anilistID).toBeNull();
      expect(result?.malID).toBeNull();
    });

    it('resolves direct m3u8 sources from HTML video/source tags', async () => {
      const mockEmbedHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <video id="vplayer" controls>
            <source src="https://vidcdn.pro/play/ep1.m3u8" type="application/x-mpegURL">
            <track src="https://vidcdn.pro/sub/ep1.vtt" label="English" kind="subtitles" default>
          </video>
        </body>
        </html>
      `;

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockEmbedHtml,
      } as Response);

      const result = await extractGogoSourcesFromEmbed('https://vidcdn.pro/embed/123');

      expect(result).not.toBeNull();
      expect(result?.sources[0].url).toBe('https://vidcdn.pro/play/ep1.m3u8');
      expect(result?.sources[0].isM3U8).toBe(true);
      expect(result?.subtitles[0].url).toBe('https://vidcdn.pro/sub/ep1.vtt');
    });

    it('resolves sources from Vidstreaming ajax endpoint if embed contains ajax link or payload', async () => {
      const mockEmbedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            var episode_id = "998877";
          </script>
        </head>
        <body data-id="998877">
          <div class="videocontent"></div>
        </body>
        </html>
      `;

      const mockAjaxJson = JSON.stringify({
        source: [
          { file: 'https://hls.gogocdn.net/anime/master.m3u8', label: '1080p', type: 'hls' },
          { file: 'https://hls.gogocdn.net/anime/720p.m3u8', label: '720p', type: 'hls' },
        ],
        source_bk: [
          { file: 'https://backup.gogocdn.net/anime/backup.m3u8', label: 'backup', type: 'hls' },
        ],
        track: {
          tracks: [
            { file: 'https://hls.gogocdn.net/sub/en.vtt', label: 'English', kind: 'captions' },
          ],
        },
      });

      // First call is embed page, second is ajax endpoint
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockEmbedHtml,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockAjaxJson,
        } as Response);

      const result = await extractGogoSourcesFromEmbed('https://embtaku.pro/streaming.php?id=998877');

      expect(result).not.toBeNull();
      expect(result?.sources.length).toBeGreaterThanOrEqual(1);
      expect(result?.sources[0].url).toBe('https://hls.gogocdn.net/anime/master.m3u8');
      expect(result?.sources[0].isM3U8).toBe(true);
      expect(result?.subtitles[0].url).toBe('https://hls.gogocdn.net/sub/en.vtt');
    });

    it('returns null gracefully when embed HTML contains no m3u8 stream', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><body>Video not found</body></html>',
      } as Response);

      const result = await extractGogoSourcesFromEmbed('https://embtaku.pro/streaming.php?id=empty');
      expect(result).toBeNull();
    });

    it('returns null gracefully on HTTP error response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as Response);

      const result = await extractGogoSourcesFromEmbed('https://embtaku.pro/streaming.php?id=404');
      expect(result).toBeNull();
    });

    it('returns null gracefully on network timeout or fetch error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network timeout'));

      const result = await extractGogoSourcesFromEmbed('https://embtaku.pro/streaming.php?id=timeout');
      expect(result).toBeNull();
    });
  });

  describe('resolveGogoSources', () => {
    it('successfully orchestrates slug -> episode page -> embed -> stream result', async () => {
      const mockEpisodeHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="play-video">
            <iframe src="//embtaku.pro/streaming.php?id=MTE5OTU4&title=Frieren" allowfullscreen="true"></iframe>
          </div>
        </body>
        </html>
      `;

      const mockEmbedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            const player = {
              sources: [
                { file: "https://gogocdn.stream/hls/frieren/ep.1/master.m3u8", label: "auto" }
              ]
            };
          </script>
        </head>
        </html>
      `;

      // 1st fetch: Gogo episode page
      // 2nd fetch: Embed iframe page
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockEpisodeHtml,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockEmbedHtml,
        } as Response);

      const stream = await resolveGogoSources("Frieren: Beyond Journey's End", 1);

      expect(stream).not.toBeNull();
      expect(stream?.sources[0].url).toBe('https://gogocdn.stream/hls/frieren/ep.1/master.m3u8');
      expect(stream?.sources[0].isM3U8).toBe(true);
      expect(stream?.headers.Referer).toBeDefined();
      expect(stream?.headers['User-Agent']).toBeDefined();
    });

    it('returns null when episode page returns 404', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '404 Not Found',
      } as Response);

      const stream = await resolveGogoSources('Nonexistent Anime Show', 1);
      expect(stream).toBeNull();
    });

    it('returns null when episode page HTML contains no streaming iframe', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><body>Empty episode list</body></html>',
      } as Response);

      const stream = await resolveGogoSources('One Piece', 99999);
      expect(stream).toBeNull();
    });

    it('returns null when network request aborts or throws an exception', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection reset by peer'));

      const stream = await resolveGogoSources('Bleach', 1);
      expect(stream).toBeNull();
    });

    it('returns null when title or episode number is invalid', async () => {
      expect(await resolveGogoSources('', 1)).toBeNull();
      expect(await resolveGogoSources('   ', 1)).toBeNull();
    });
  });
});

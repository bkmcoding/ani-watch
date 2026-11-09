import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';
import { browseController } from '../../src/handlers/pages/browse';

function getWatchApp() {
  const app = new Hono();
  app.get('/watch', watchController);
  return app;
}

function getBrowseApp() {
  const app = new Hono();
  app.get('/browse', browseController);
  return app;
}

describe('Watch Progress Tracking & YouTube Shortcuts (Task 5)', () => {
  describe('Episode Watched Progress Tracking in watch.ts', () => {
    it('persists episode progress ratio, duration, and time in localStorage on timeupdate', async () => {
      const app = getWatchApp();
      const res = await app.request('/watch?anime=one-piece&ep=100&sub=https://example.com/stream.m3u8');
      const html = await res.text();

      // Checks ani.progress.<animeId>.<epNum> storage key
      expect(html).toContain("localStorage.setItem('ani.progress.' + animeId + '.' + currentEpNum");
      // Ratio calculation
      expect(html).toMatch(/Math\.min\(1,\s*Math\.max\(0,\s*(?:video\.currentTime|curT)\s*\/\s*(?:video\.duration|dur)\)\)/);
      // Stores time, dur, and ratio
      expect(html).toContain('time:');
      expect(html).toContain('dur:');
      expect(html).toContain('ratio:');
      // Minimum duration guard (> 10 seconds)
      expect(html).toMatch(/duration\s*>\s*10|duration\s*<=\s*10/);
    });

    it('renders .ep-progress-bar styling and checkmark in watch episode drawer', async () => {
      const app = getWatchApp();
      const res = await app.request('/watch?anime=one-piece&ep=100&sub=https://example.com/stream.m3u8');
      const html = await res.text();

      // CSS for .ep-progress-bar in watch.ts
      expect(html).toContain('.ep-progress-bar');
      expect(html).toMatch(/\.ep-progress-bar\s*\{[^}]*height:\s*2\.5px/);
      expect(html).toMatch(/\.ep-progress-bar\s*\{[^}]*background:\s*var\(--accent/);

      // Episode drawer rendering logic reads progress & watched
      expect(html).toContain("localStorage.getItem('ani.progress.' + animeId + '.' + n)");
      expect(html).toContain("localStorage.getItem('ani.watched.' + animeId)");
      // Progress bar element injection
      expect(html).toContain('ep-progress-bar');
      // Completion checkmark ✓ when ratio >= 0.9 or episode in ani.watched
      expect(html).toMatch(/0\.9/);
      expect(html).toContain('✓');
    });
  });

  describe('Episode Watched Progress Bars in browse.ts', () => {
    it('includes .ep-progress-bar CSS styling in browse page', async () => {
      const app = getBrowseApp();
      const res = await app.request('/browse');
      const html = await res.text();

      expect(html).toContain('.ep-progress-bar');
      expect(html).toMatch(/\.ep-progress-bar\s*\{[^}]*height:\s*2\.5px/);
      expect(html).toMatch(/\.ep-progress-bar\s*\{[^}]*background:\s*var\(--accent/);
    });

    it('reads ani.progress and ani.watched when rendering episode cards in browse page', async () => {
      const app = getBrowseApp();
      const res = await app.request('/browse');
      const html = await res.text();

      expect(html).toMatch(/localStorage\.getItem\(\s*['"]ani\.progress\.['"]\s*\+/);
      expect(html).toMatch(/localStorage\.getItem\(\s*['"]ani\.watched\.['"]\s*\+/);
      expect(html).toContain('ep-progress-bar');
      expect(html).toMatch(/0\.9/);
      expect(html).toContain('✓');
    });
  });

  describe('YouTube / Vim Keyboard Shortcuts & Feedback', () => {
    it('implements J, K, L, M, C, N shortcuts in watch.ts keydown handler', async () => {
      const app = getWatchApp();
      const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
      const html = await res.text();

      // J: seek -10s with OSD
      expect(html).toMatch(/e\.key\s*===\s*['"]j['"]\s*\|\|\s*e\.key\s*===\s*['"]J['"]/);
      expect(html).toContain("showOsd('⏪', '-10s')");

      // K: play / pause
      expect(html).toMatch(/e\.key\s*===\s*['"]k['"]\s*\|\|\s*e\.key\s*===\s*['"]K['"]/);

      // L: seek +10s with OSD
      expect(html).toMatch(/e\.key\s*===\s*['"]l['"]\s*\|\|\s*e\.key\s*===\s*['"]L['"]/);
      expect(html).toContain("showOsd('⏩', '+10s')");

      // M: toggle mute with OSD
      expect(html).toMatch(/e\.key\s*===\s*['"]m['"]\s*\|\|\s*e\.key\s*===\s*['"]M['"]/);
      expect(html).toMatch(/showOsd\(\s*video\.muted\s*\?\s*['"]🔇['"]\s*:\s*['"]🔊['"],\s*video\.muted\s*\?\s*['"]Muted['"]\s*:\s*['"]Unmuted['"]\s*\)/);

      // C: toggle captions
      expect(html).toMatch(/e\.key\s*===\s*['"]c['"]\s*\|\|\s*e\.key\s*===\s*['"]C['"]/);

      // N: next episode navigation
      expect(html).toMatch(/e\.key\s*===\s*['"]n['"]\s*\|\|\s*e\.key\s*===\s*['"]N['"]/);

      // Shift+P or [ for previous episode navigation
      expect(html).toMatch(/e\.shiftKey\s*&&\s*\(e\.key\s*===\s*['"]P['"]\s*\|\|\s*e\.key\s*===\s*['"]p['"]\)/);

      // P for Picture-in-Picture remains supported
      expect(html).toMatch(/e\.key\s*===\s*['"]p['"]\s*\|\|\s*e\.key\s*===\s*['"]P['"]/);
    });

    it('documents J, K, L, M, C, N, P shortcuts in #shortcutsModal', async () => {
      const app = getWatchApp();
      const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
      const html = await res.text();

      expect(html).toContain('id="shortcutsModal"');
      expect(html).toContain('<kbd>J</kbd>');
      expect(html).toContain('<kbd>K</kbd>');
      expect(html).toContain('<kbd>L</kbd>');
      expect(html).toContain('<kbd>M</kbd>');
      expect(html).toContain('<kbd>C</kbd>');
      expect(html).toContain('<kbd>N</kbd>');
      expect(html).toContain('<kbd>P</kbd>');
      expect(html).toContain('Next Episode');
      expect(html).toContain('Previous Episode');
    });
  });
});

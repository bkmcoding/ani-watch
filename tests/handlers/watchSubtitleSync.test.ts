import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Subtitle Timing Synchronization & Global Audio Preference', () => {
  it('renders Subtitle Sync offset slider, label, and reset button in #ccControls', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request(
      '/watch?sub=https://example.com/stream.m3u8&subCc=https://example.com/sub.vtt'
    );
    const html = await res.text();

    expect(html).toContain('id="ccControls"');
    expect(html).toContain('id="ccOffset"');
    expect(html).toContain('id="ccOffsetReset"');
    expect(html).toContain('id="ccOffsetLabel"');
    expect(html).toContain('Subtitle Sync');
    expect(html).toContain('min="-2.0"');
    expect(html).toContain('max="2.0"');
    expect(html).toContain('step="0.1"');
    expect(html).toContain('aria-label="Subtitle sync offset"');
  });

  it('manages subOffset state with ani.subOffset localStorage persistence and clamping', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request(
      '/watch?sub=https://example.com/stream.m3u8&subCc=https://example.com/sub.vtt'
    );
    const html = await res.text();

    expect(html).toContain("'ani.subOffset'");
    expect(html).toContain("localStorage.getItem('ani.subOffset')");
    expect(html).toContain("localStorage.setItem('ani.subOffset'");
    expect(html).toContain('subOffset');
  });

  it('evaluates cues in renderCcAt using effectiveTime with subOffset adjustment', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request(
      '/watch?sub=https://example.com/stream.m3u8&subCc=https://example.com/sub.vtt'
    );
    const html = await res.text();

    expect(html).toContain('renderCcAt');
    expect(html).toContain('effectiveTime');
    expect(html).toMatch(/effectiveTime\s*=\s*Math\.max\(0,\s*t\s*\+\s*subOffset\)/);
  });

  it('binds Z and X keyboard shortcuts to adjust subOffset with Action OSD feedback', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request(
      '/watch?sub=https://example.com/stream.m3u8&subCc=https://example.com/sub.vtt'
    );
    const html = await res.text();

    // Check Z/z and X/x shortcuts
    expect(html).toMatch(/e\.key\s*===\s*'z'\s*\|\|\s*e\.key\s*===\s*'Z'/);
    expect(html).toMatch(/e\.key\s*===\s*'x'\s*\|\|\s*e\.key\s*===\s*'X'/);

    // OSD message for subtitle sync
    expect(html).toContain("showOsd('💬'");
    expect(html).toContain('Sub Sync:');
  });

  it('documents Z and X keyboard shortcuts in #shortcutsModal', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('id="shortcutsModal"');
    expect(html).toContain('<kbd>Z</kbd>');
    expect(html).toContain('<kbd>X</kbd>');
    expect(html).toContain('Subtitle Sync');
  });

  it('persists audio preference to ani.audioPref on track changes and loads it when no category query is provided', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request(
      '/watch?sub=https://example.com/stream.m3u8&dub=https://example.com/dub.m3u8'
    );
    const html = await res.text();

    expect(html).toContain("'ani.audioPref'");
    expect(html).toContain("localStorage.setItem('ani.audioPref'");
    expect(html).toContain("localStorage.getItem('ani.audioPref')");
    expect(html).toMatch(/urlParams\.has\('category'\)/);
  });
});

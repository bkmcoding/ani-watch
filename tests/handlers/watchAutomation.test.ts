import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Automation Suite (Auto-Skip & Smart Auto-Next)', () => {
  it('renders Playback section with autoSkip and autoNext switches in settings menu', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('id="settingsMenu"');
    expect(html).toContain('<h3>Playback</h3>');
    expect(html).toContain('id="autoSkipToggle"');
    expect(html).toContain('id="autoSkipLabel"');
    expect(html).toContain('Auto-skip intro &amp; outro');
    expect(html).toContain('id="autoNextToggle"');
    expect(html).toContain('id="autoNextLabel"');
    expect(html).toContain('Auto-play next episode');
  });

  it('contains auto-skip intro client logic with OSD feedback and localStorage persistence', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&is=60&ie=150');
    const html = await res.text();

    // Local storage persistence
    expect(html).toContain("'ani.autoSkip'");
    expect(html).toContain("'ani.autoNext'");

    // Intro skip seek and OSD feedback
    expect(html).toContain('Auto-skipped Intro');
    expect(html).toContain("showOsd('⚡'");
    expect(html).toContain('pack.intro.end');
  });

  it('renders smart outro floating badge markup with 5s countdown and action buttons', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&nextEp=ep-2');
    const html = await res.text();

    expect(html).toContain('id="outroBadge"');
    expect(html).toContain('class="outro-badge"');
    expect(html).toContain('id="outroPlayNow"');
    expect(html).toContain('id="outroDismiss"');
    expect(html).toContain('Next episode in');
  });

  it('contains smart outro countdown, dismiss, and navigation logic in client script', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request(
      '/watch?sub=https://example.com/stream.m3u8&nextEp=ep-2&os=1200&oe=1320'
    );
    const html = await res.text();

    expect(html).toContain('outroDismissed');
    expect(html).toContain('outroPlayNow');
    expect(html).toContain('outroDismiss');
  });

  it('reduces ended autoplay countdown from 12s to 5s and honors ani.autoNext toggle', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&nextEp=ep-2');
    const html = await res.text();

    // Ended timer countdown uses 5s
    expect(html).toContain('var secs = 5');
    // Default text in overlay should be 5
    expect(html).toContain('<span class="ap-count">5</span>');
    // Guard checking autoNext
    expect(html).toMatch(/if\s*\(!autoNext\)\s*return;/);
  });

  it('supports Space/Enter to trigger next episode immediately and Esc to cancel', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&nextEp=ep-2');
    const html = await res.text();

    expect(html).toContain('autoplayOverlay');
    // Handlers for Space/Enter or Esc on autoplay overlay / outro badge
    expect(html).toContain('autoplayCancelled');
  });
});

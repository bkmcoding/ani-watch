import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Mobile Touch Gestures & Press-and-Hold 2.0x Boost', () => {
  it('renders #seekRippleOverlay and #holdSpeedPill markup with proper accessibility attributes', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // #seekRippleOverlay container
    expect(html).toContain('id="seekRippleOverlay"');
    expect(html).toContain('class="seek-ripple-overlay"');
    expect(html).toMatch(/<div\s+id="seekRippleOverlay"[^>]*hidden[^>]*aria-hidden="true"/);

    // Left and right ripple waves
    expect(html).toContain('class="ripple-wave ripple-left"');
    expect(html).toContain('class="ripple-wave ripple-right"');
    expect(html).toContain('<div class="ripple-arrows">◀◀</div>');
    expect(html).toContain('<div class="ripple-arrows">▶▶</div>');
    expect(html).toContain('<span class="ripple-secs">10</span>');

    // #holdSpeedPill
    expect(html).toContain('id="holdSpeedPill"');
    expect(html).toContain('class="hold-speed-pill"');
    expect(html).toMatch(/<div\s+id="holdSpeedPill"[^>]*hidden[^>]*aria-hidden="true"[^>]*>\s*2x ▶▶\s*<\/div>/);
  });

  it('includes CSS styling for ripple waves and glassmorphic hold speed pill', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // CSS for overlay and ripples
    expect(html).toMatch(/\.seek-ripple-overlay\s*\{[^}]*pointer-events:\s*none/);
    expect(html).toContain('.ripple-wave');
    expect(html).toContain('.ripple-left');
    expect(html).toContain('.ripple-right');
    expect(html).toContain('@keyframes rippleExpand');

    // Glassmorphic styling for hold speed pill
    expect(html).toMatch(/\.hold-speed-pill\s*\{[^}]*pointer-events:\s*none/);
    expect(html).toMatch(/\.hold-speed-pill\s*\{[^}]*backdrop-filter:\s*blur/);
  });

  it('partitions stage width into left (0-33%), center (33-66%), and right (66-100%) zones', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Zone calculation
    expect(html).toMatch(/0\.33/);
    expect(html).toMatch(/0\.66/);
    expect(html).toContain('lastTapZone');
  });

  it('implements double-tap seeking with 650ms compounding counter', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Compounding logic and 650ms window
    expect(html).toContain('compoundSeekSecs');
    expect(html).toContain('650');
    expect(html).toMatch(/compoundSeekSecs\s*\+=\s*10/);
    expect(html).toMatch(/video\.currentTime\s*=\s*Math\.max\(0,\s*\(?video\.currentTime/);
    expect(html).toMatch(/video\.currentTime\s*=\s*Math\.min\(\(?video\.duration/);
  });

  it('toggles fullscreen on center double-tap', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Center zone triggers fullscreen
    expect(html).toMatch(/zone\s*===\s*'center'[\s\S]*toggleFs\(\)/);
  });

  it('implements press-and-hold 2.0x playback rate boost with 400ms timer', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('holdTimer');
    expect(html).toContain('isHoldingSpeed');
    expect(html).toContain('preHoldSpeed');
    expect(html).toContain('400');
    expect(html).toMatch(/video\.playbackRate\s*=\s*2(\.0)?/);
    expect(html).toMatch(/video\.playbackRate\s*=\s*preHoldSpeed/);
    expect(html).toMatch(/holdSpeedPill\.hidden\s*=\s*false/);
    expect(html).toMatch(/holdSpeedPill\.hidden\s*=\s*true/);
  });

  it('preserves single-tap controls toggle without conflicting with double-tap', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('singleTapTimer');
    expect(html).toContain('handleStageSingleTap()');
    expect(html).toContain('wasVisibleAtTouchStart');
  });
});

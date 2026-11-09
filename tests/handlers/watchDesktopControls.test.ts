import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Desktop Controls & Ergonomics', () => {
  it('renders dedicated PiP button in controls bar with accessible hotkey tooltip', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('id="pipBtnBar"');
    expect(html).toContain('title="Picture in Picture (P)"');
  });

  it('contains desktop double-click to fullscreen and wheel volume handlers in client script', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain("stage.addEventListener('dblclick'");
    expect(html).toContain("stage.addEventListener('wheel'");
    expect(html).toContain("deltaY < 0");
  });

  it('supports P keyboard shortcut for Picture-in-Picture and documents it in shortcuts modal', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain("e.key === 'p' || e.key === 'P'");
    expect(html).toContain('<kbd>P</kbd>');
    expect(html).toContain('Picture-in-Picture');
  });

  it('contains expand-on-hover CSS for volume slider on hover-capable devices', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('.vol-group');
    expect(html).toContain('.vol-group:hover .vol');
  });

  it('standardizes control button tooltips with hotkey discovery', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('title="Play/Pause (Space)"');
    expect(html).toContain('title="Mute (M)"');
    expect(html).toContain('title="Theater mode (T)"');
    expect(html).toContain('title="Fullscreen (F)"');
  });
});

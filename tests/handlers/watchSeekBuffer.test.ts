import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Seekbar Scrub Preview & Buffered Track', () => {
  it('renders seek-tooltip element inside seek-wrap', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('class="seek-tooltip"');
    expect(html).toContain('id="seekTooltip"');
  });

  it('contains CSS styling for multi-layer buffer track and tooltip positioning', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('--buffered');
    expect(html).toContain('.seek-tooltip');
  });

  it('updates --buffered CSS property on progress and timeupdate events', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('video.buffered');
    expect(html).toContain("seek.style.setProperty('--buffered'");
  });
});

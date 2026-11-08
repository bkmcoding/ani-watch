import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch OSD, Shortcuts Dialog & Episode Filter', () => {
  it('renders Action OSD HUD element at top-center', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('id="actionOsd"');
    expect(html).toContain('class="action-osd"');
  });

  it('renders Keyboard Shortcuts dialog with accessible attributes', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('id="shortcutsModal"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Keyboard Shortcuts');
  });

  it('renders episode search/filter input in episode drawer', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('id="epSearchInput"');
    expect(html).toContain('placeholder="Filter episodes');
  });
});

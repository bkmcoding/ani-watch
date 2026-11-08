import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

describe('Browse Episode Range Chunking & Jump Navigation', () => {
  it('contains episode chunking logic for anime with > 50 episodes', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('ep-chunk-bar');
    expect(html).toContain('ep-jump-input');
    expect(html).toContain('CHUNK_SIZE = 50');
  });

  it('renders jump input allowing fast navigation to any episode number', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('Jump to ep #');
  });

  it('enforces touch targets and mobile accessibility for chunk navigation', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toMatch(/\.ep-chunk-pill\s*\{[^}]*min-height:\s*44px;/);
    expect(html).toMatch(/\.ep-chunk-pill\s*\{[^}]*min-width:\s*44px;/);
    expect(html).toMatch(/\.ep-jump-input\s*\{[^}]*min-height:\s*44px;/);
  });
});

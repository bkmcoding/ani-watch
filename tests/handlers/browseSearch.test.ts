import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

describe('Browse Debounced Live Search & Clear Button', () => {
  it('renders search clear buttons in desktop and mobile search containers', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('id="qClear"');
    expect(html).toContain('id="qMobileClear"');
    expect(html).toContain('class="search-clear-btn');
  });

  it('contains debounced input handler in client script', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('searchDebounceTimer');
    expect(html).toContain('300');
  });

  it('renders rich empty state with recovery recommendation pills', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('empty-search');
    expect(html).toContain('Clear search');
  });
});

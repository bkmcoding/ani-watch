import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { landingController } from '../../src/handlers/pages/landing';

function getApp() {
  const app = new Hono();
  app.get('/', landingController);
  return app;
}

describe('Landing Page Desktop Hotkeys & Search Discovery', () => {
  it('renders desktop search shortcut badge in hero search container', async () => {
    const app = getApp();
    const res = await app.request('/');
    const html = await res.text();

    expect(html).toContain('search-badge');
    expect(html).toMatch(/<kbd class=["']search-badge["']>\/<\/kbd>/);
  });

  it('contains desktop / and Ctrl+K search focus and Escape blur handlers in client script', async () => {
    const app = getApp();
    const res = await app.request('/');
    const html = await res.text();

    expect(html).toContain('landingSearchInput');
    // Checks keydown listener handling / or Ctrl+K / Cmd+K
    expect(html).toMatch(
      /e\.key\s*===\s*['"]\/['"]\s*\|\|\s*\(\(e\.ctrlKey\s*\|\|\s*e\.metaKey\)\s*&&\s*\(e\.key\s*===\s*['"]k['"]\s*\|\|\s*e\.key\s*===\s*['"]K['"]\)\)/
    );
    expect(html).toContain('landingSearchInput.focus()');
    expect(html).toContain('landingSearchInput.select()');
    expect(html).toMatch(/e\.key\s*===\s*['"]Escape['"][\s\S]*?landingSearchInput\.blur\(\)/);
  });
});

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

function getApp() {
  const app = new Hono();
  app.get('/browse', browseController);
  return app;
}

describe('Browse Desktop Miniplayer & Ergonomics', () => {
  it('renders cinema minimize button and minimized dock CSS', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    // Minimize button in cinema actions
    expect(html).toContain('id="cinemaMinimize"');
    expect(html).toMatch(/aria-label=["']Minimize( player)?["']/i);

    // Minimized dock CSS rules
    expect(html).toContain('.cinema-overlay.is-minimized');
    expect(html).toMatch(/\.cinema-overlay\.is-minimized\s+\.cinema-backdrop\s*\{\s*display:\s*none/);
    expect(html).toMatch(/\.cinema-overlay\.is-minimized\s+\.cinema-stage/);
  });

  it('contains cinema minimize toggle client script logic', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    expect(html).toContain('cinemaMinimize');
    expect(html).toContain("classList.toggle('is-minimized')");
  });

  it('renders floating back-to-top button and scroll-to-top client script', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    expect(html).toContain('id="backToTop"');
    expect(html).toContain("window.scrollTo");
    expect(html).toContain("scrollY > 500");
  });

  it('includes desktop card quick play button styles for hover-capable devices', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    expect(html).toContain('.card-quick-play');
    expect(html).toMatch(/@media\s*\(\s*hover:\s*hover\s*\)[\s\S]*?\.card:hover\s+\.card-quick-play/);
  });
});

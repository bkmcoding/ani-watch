import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

describe('Browse Mobile Ergonomics', () => {
  it('enforces 16px font-size on mobile inputs and includes safe-area insets', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('safe-area-inset-bottom');
    // Checks that inputs on mobile have 16px font-size
    expect(html).toMatch(/@media\s*\(max-width:\s*720px\)[^}]*input[^}]*font-size:\s*16px/);
  });

  it('ensures search-fab has at least 48px touch targets and safe area insets', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();

    expect(html).toContain('.search-fab');
    expect(html).toMatch(/\.search-fab\s*\{[^}]*min-width:\s*48px;/);
    expect(html).toMatch(/\.search-fab\s*\{[^}]*min-height:\s*48px;/);
    expect(html).toContain('bottom: max(20px, calc(env(safe-area-inset-bottom) + 16px))');
  });

  it('ensures watchlist and quick action buttons have minimum 44px touch targets with active tactile scaling', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();

    // Verify ::after hit-slop provides min 44px touch target
    expect(html).toMatch(/\.wl-btn::after\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
    expect(html).toMatch(/\.cw-remove-btn::after\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);

    // Verify active tactile scaling exists for touch feedback
    expect(html).toMatch(/\.wl-btn:active\s*\{[^}]*transform:\s*scale\(/);
    expect(html).toMatch(/\.cw-remove-btn:active\s*\{[^}]*transform:\s*scale\(/);
  });

  it('ensures safe area padding on headers and overlays', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();

    // Overlays should include safe-area insets
    expect(html).toMatch(/\.search-overlay\s*\{[^}]*env\(safe-area-inset-top\)/);
    expect(html).toMatch(/\.search-overlay\s*\{[^}]*env\(safe-area-inset-bottom\)/);
    expect(html).toContain('safe-area-inset-left');
    expect(html).toContain('safe-area-inset-right');
  });
});

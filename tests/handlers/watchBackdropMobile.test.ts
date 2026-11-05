import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Settings Backdrop & Layering', () => {
  it('suppresses sheet-backdrop on desktop and sets safe z-index hierarchy', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Backdrop must be hidden on desktop
    expect(html).toContain('@media (min-width: 721px) and (min-height: 541px)');

    // Backdrop must not blur dialogs or page
    expect(html).not.toMatch(/\.sheet-backdrop\s*\{[^}]*backdrop-filter:\s*blur/);
    expect(html).toMatch(/\.sheet-backdrop\s*\{[^}]*backdrop-filter:\s*none\s*!important/);

    // Default sheet-backdrop must be z-index 90
    expect(html).toMatch(/\.sheet-backdrop\s*\{[^}]*z-index:\s*90/);

    // .menu and .ep-panel must have z-index 100 to layer over backdrop
    expect(html).toMatch(/\.menu\s*\{[^}]*z-index:\s*100/);
    expect(html).toMatch(/\.ep-panel\s*\{[^}]*z-index:\s*100/);
  });
});

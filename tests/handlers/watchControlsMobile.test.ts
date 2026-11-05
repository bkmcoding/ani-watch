import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Mobile Controls CSS & Scoping', () => {
  it('scopes :focus-within to hover-capable or focus-visible devices', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('@media (hover: hover)');
    expect(html).not.toMatch(/\.stage:focus-within\s*\.controls\s*\{\s*opacity:\s*1/);
  });

  it('includes touch blur on button clicks and single-tap dismiss in client script', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain("matchMedia('(pointer: coarse)').matches");
    expect(html).toContain('.blur()');
  });
});

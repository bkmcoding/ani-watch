import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Adaptive Drawers System', () => {
  it('contains portrait bottom sheet and landscape right slide-over rules', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Landscape media query
    expect(html).toContain('max-height: 540px');
    expect(html).toContain('translateX(100%)');

    // Portrait mobile bottom sheet rules
    expect(html).toContain(
      '@media (max-width: 720px) and (orientation: portrait), (max-width: 540px)'
    );
    expect(html).toContain('max-height: min(85dvh, 560px)');
    expect(html).toContain('translateY(100%)');

    // Landscape phone right slide-over drawer rules
    expect(html).toContain('@media (max-height: 540px) and (orientation: landscape)');
    expect(html).toContain('width: min(340px, 45vw)');
    expect(html).toContain('translateX(0)');
    expect(html).toContain('safe-area-inset-right');
  });
});

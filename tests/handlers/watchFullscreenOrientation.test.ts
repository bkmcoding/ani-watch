import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Fullscreen & Orientation Handlers', () => {
  it('includes Screen Orientation API and fullscreenchange synchronization', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Orientation lock & unlock
    expect(html).toContain('screen.orientation.lock');
    expect(html).toContain('screen.orientation.unlock');

    // iOS fallback
    expect(html).toContain('isIosPhone');
    expect(html).toContain('video.webkitEnterFullscreen');

    // Fullscreen event listeners
    expect(html).toContain('fullscreenchange');
    expect(html).toContain('webkitfullscreenchange');
    expect(html).toContain('webkitendfullscreen');

    // State sync: .is-fullscreen, aria-label, title, blur, pokeControls
    expect(html).toContain("stage.classList.toggle('is-fullscreen', isFs)");
    expect(html).toContain("document.body.classList.toggle('is-fullscreen', isFs)");
    expect(html).toContain(
      "fsBtn.setAttribute('title', isFs ? 'Exit Fullscreen (F)' : 'Fullscreen (F)')"
    );
    expect(html).toContain(
      "fsBtn.setAttribute('aria-label', isFs ? 'Exit Fullscreen' : 'Fullscreen')"
    );
    expect(html).toContain('document.activeElement.blur');
    expect(html).toContain('pokeControls()');
  });
});

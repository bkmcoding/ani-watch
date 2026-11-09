import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

function getApp() {
  const app = new Hono();
  app.get('/watch', watchController);
  return app;
}

describe('Watch Desktop Player Ergonomics (Extended)', () => {
  it('documents complete keyboard shortcuts in shortcutsModal (0-9, speed, sub/dub, episodes)', async () => {
    const app = getApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('shortcutsModal');
    // Number keys percentage seek
    expect(html).toMatch(/<kbd>0<\/kbd>.*?<kbd>9<\/kbd>/);
    expect(html).toContain('Seek 0%–90%');

    // Speed hotkeys
    expect(html).toMatch(/<kbd>&lt;<\/kbd>.*?<kbd>&gt;<\/kbd>|<kbd><<\/kbd>.*?<kbd>><\/kbd>/);
    expect(html).toMatch(/Speed|Playback Speed/i);

    // Audio Sub/Dub toggle
    expect(html).toMatch(/<kbd>S<\/kbd>.*?<kbd>D<\/kbd>/);
    expect(html).toMatch(/Sub \/ Dub/i);

    // Episodes drawer hotkey
    expect(html).toContain('<kbd>E</kbd>');
    expect(html).toMatch(/Episode list|Episode drawer|Episodes/i);
  });

  it('implements 0-9 number keys percentage seeking with OSD feedback in client script', async () => {
    const app = getApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Checks keydown listener handling digits 0 to 9
    expect(html).toMatch(/e\.key\s*>=\s*['"]0['"]\s*&&\s*e\.key\s*<=\s*['"]9['"]/);
    expect(html).toContain('video.duration');
    expect(html).toContain('showOsd');
  });

  it('implements seek bar mouse wheel scrubbing on seek-wrap with non-passive preventDefault', async () => {
    const app = getApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain("seekWrap.addEventListener('wheel'");
    expect(html).toMatch(/seekWrap\.addEventListener\('wheel'.*?\{\s*passive:\s*false\s*\}/s);
  });
});

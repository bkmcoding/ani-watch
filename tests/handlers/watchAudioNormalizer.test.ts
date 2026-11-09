import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Audio Normalizer (Stable Volume via Web Audio API)', () => {
  it('renders Stable Volume toggle and label under Audio section in settings menu', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('id="settingsMenu"');
    expect(html).toContain('<h3>Audio</h3>');
    expect(html).toContain('id="stableVolumeLabel"');
    expect(html).toContain('for="stableVolumeToggle"');
    expect(html).toContain('title="Balances quiet dialogue and loud action scenes"');
    expect(html).toContain('>Stable Volume</label>');
    expect(html).toContain('id="stableVolumeToggle"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-labelledby="stableVolumeLabel"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('contains ani.stableVolume reading and persistence in localStorage', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain("'ani.stableVolume'");
    expect(html).toContain("localStorage.getItem('ani.stableVolume')");
    expect(html).toContain("localStorage.setItem('ani.stableVolume'");
  });

  it('defines initAudioNormalizer with dynamics compressor parameters and safe try/catch', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('initAudioNormalizer');
    expect(html).toContain('AudioContext || window.webkitAudioContext');
    expect(html).toContain('createMediaElementSource(video)');
    expect(html).toContain('createDynamicsCompressor()');

    // Compressor parameters
    expect(html).toContain('threshold.value = -24');
    expect(html).toContain('knee.value = 30');
    expect(html).toContain('attack.value = 0.003');
    expect(html).toContain('release.value = 0.25');

    // Graph connection
    expect(html).toContain('source.connect(compressor)');
    expect(html).toContain('compressor.connect(audioCtx.destination)');
  });

  it('supports bypass mode with linear pass-through (ratio 1 vs 12) and context resume', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Bypass mode when off: ratio 1; when on: ratio 12
    expect(html).toContain('compressor.ratio.value = 1');
    expect(html).toContain('compressor.ratio.value = 12');
    expect(html).toContain('resume()');
  });

  it('provides Action OSD feedback on toggle', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain("showOsd('🔊', 'Stable Volume: On')");
    expect(html).toContain("showOsd('🔊', 'Stable Volume: Off')");
  });

  it('lazy initializes normalizer on play or toggle', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    expect(html).toContain('stableVolumeToggle.addEventListener');
    expect(html).toMatch(/video\.addEventListener\('play'[\s\S]*initAudioNormalizer/);
  });
});

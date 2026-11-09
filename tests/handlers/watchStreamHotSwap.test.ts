import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Zero-Reload Stream Hot-Swapping & Auto-Failover (Task 6)', () => {
  const createTestApp = () => {
    const app = new Hono();
    app.get('/watch', watchController);
    return app;
  };

  it('renders #streamRecoveryOverlay HTML and styling inside the player stage', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&ep=one-piece?ep=1');
    expect(res.status).toBe(200);
    const html = await res.text();

    // Verify recovery overlay exists, is hidden by default, and has aria accessibility
    expect(html).toContain('id="streamRecoveryOverlay"');
    expect(html).toContain('class="recovery-overlay"');
    expect(html).toMatch(/<div[^>]*id="streamRecoveryOverlay"[^>]*hidden/);

    // Verify overlay content: title, message, and action buttons
    expect(html).toContain('Playback failed on all available servers');
    expect(html).toContain('id="recoveryRetryBtn"');
    expect(html).toContain('id="recoverySwitchAudioBtn"');
    expect(html).toContain('id="recoveryCloseBtn"');

    // Verify CSS styling rules for recovery overlay
    expect(html).toContain('.recovery-overlay');
    expect(html).toContain('.recovery-card');
    expect(html).toContain('.recovery-actions');
    expect(html).toMatch(/\.recovery-overlay\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  });

  it('defines switchServer in client script with state preservation and concurrency guards', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&ep=one-piece?ep=1');
    const html = await res.text();

    // Verify switchServer function exists in script
    expect(html).toMatch(/(?:async\s+function\s+switchServer|var\s+switchServer\s*=\s*async\s+function)/);

    // Verify concurrency & redundant switch guard
    expect(html).toMatch(/if\s*\(\s*(?:switchingServer|switching)\s*\|\|\s*newServer\s*===\s*(?:currentServer|activeServer)\s*\)\s*return/);

    // Verify state preservation: currentTime, paused state, and playbackRate
    expect(html).toContain('video.currentTime');
    expect(html).toMatch(/video\.paused/);
    expect(html).toContain('video.playbackRate');

    // Verify OSD HUD notifications for switching and success
    expect(html).toMatch(/showOsd\(['"']⚡['"'],\s*['"`]Switching to/);
    expect(html).toMatch(/showOsd\(['"']✓['"'],\s*['"`]Switched to/);

    // Verify fetching episode sources endpoint
    expect(html).toContain('/api/v2/hianime/episode/sources');
    expect(html).toContain('animeEpisodeId');

    // Verify Hls.js dynamic manifest reloading and loadedmetadata restoration
    expect(html).toContain('hls.loadSource');
    expect(html).toContain('loadedmetadata');
  });

  it('persists preferred server in localStorage upon switching', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&ep=one-piece?ep=1');
    const html = await res.text();

    // Verify localStorage.setItem('ani.preferredServer', ...)
    expect(html).toMatch(/localStorage\.setItem\(\s*['"]ani\.preferredServer['"]\s*,\s*newServer\s*\)/);
  });

  it('wires server chip click handlers to call switchServer', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&ep=one-piece?ep=1');
    const html = await res.text();

    // Verify server chips click listener delegates to switchServer
    expect(html).toMatch(/switchServer\(\s*s(?:,\s*false)?\s*\)/);
  });

  it('implements self-healing auto-failover in Hls.Events.ERROR with priority cycling', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8&ep=one-piece?ep=1');
    const html = await res.text();

    // Verify fatal error handling in Hls.Events.ERROR
    expect(html).toContain('Hls.Events.ERROR');
    expect(html).toMatch(/data\.fatal/);

    // Verify 403/404 token expiry or network error interception
    expect(html).toMatch(/403|404|NETWORK_ERROR/);

    // Verify auto-failover notification OSD
    expect(html).toMatch(/Auto-switching to/);
    expect(html).toMatch(/Server error|Stream interrupted|CDN expired/);

    // Verify priority chain order across servers
    expect(html).toMatch(/hd-1/);
    expect(html).toMatch(/hd-2/);
    expect(html).toMatch(/zoko/);
    expect(html).toMatch(/gogo/);

    // Verify fallback to recovery overlay when all servers exhausted
    expect(html).toMatch(/streamRecoveryOverlay|showRecoveryOverlay/);
  });
});

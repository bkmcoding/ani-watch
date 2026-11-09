import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Player Server Bar & In-Menu Server Selector UI', () => {
  const createTestApp = () => {
    const app = new Hono();
    app.get('/watch', watchController);
    return app;
  };

  it('renders under-stage #serverBar directly below .stage-wrap with all 4 provider chips', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    expect(res.status).toBe(200);
    const html = await res.text();

    // Verify #serverBar structure and label
    expect(html).toContain('id="serverBar"');
    expect(html).toContain('class="server-bar"');
    expect(html).toContain('<span class="server-bar-label">Server</span>');
    expect(html).toContain('id="serverChips"');
    expect(html).toContain('class="server-chips"');

    // Verify ordering: stage-wrap appears before serverBar in DOM
    const stageWrapIdx = html.indexOf('class="stage-wrap"');
    const serverBarIdx = html.indexOf('id="serverBar"');
    expect(stageWrapIdx).toBeGreaterThan(-1);
    expect(serverBarIdx).toBeGreaterThan(stageWrapIdx);

    // Verify all 4 server chips with friendly labels and data-server attributes
    expect(html).toContain('data-server="hd-1"');
    expect(html).toContain('HD-1 (MegaCloud)');
    expect(html).toContain('data-server="hd-2"');
    expect(html).toContain('HD-2 (RapidCloud)');
    expect(html).toContain('data-server="zoko"');
    expect(html).toContain('Zoko');
    expect(html).toContain('data-server="gogo"');
    expect(html).toContain('Gogo (Backup)');
  });

  it('marks active server with .is-active and status-dot based on query param (default hd-1)', async () => {
    const app = createTestApp();

    // Default: hd-1 should be active
    const resDefault = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const htmlDefault = await resDefault.text();

    // Match hd-1 button and confirm is-active and status-dot
    const hd1ActiveMatch = htmlDefault.match(/<button[^>]*data-server="hd-1"[^>]*>([\s\S]*?)<\/button>/);
    expect(hd1ActiveMatch).not.toBeNull();
    expect(hd1ActiveMatch![0]).toContain('is-active');
    expect(hd1ActiveMatch![1]).toContain('class="status-dot"');

    // Confirm hd-2 button is NOT active
    const hd2InactiveMatch = htmlDefault.match(/<button[^>]*data-server="hd-2"[^>]*>([\s\S]*?)<\/button>/);
    expect(hd2InactiveMatch).not.toBeNull();
    expect(hd2InactiveMatch![0]).not.toContain('is-active');
    expect(hd2InactiveMatch![1]).not.toContain('class="status-dot"');

    // Explicit server=hd-2
    const resHd2 = await app.request('/watch?sub=https://example.com/stream.m3u8&server=hd-2');
    const htmlHd2 = await resHd2.text();
    const hd2ActiveMatch = htmlHd2.match(/<button[^>]*data-server="hd-2"[^>]*>([\s\S]*?)<\/button>/);
    expect(hd2ActiveMatch).not.toBeNull();
    expect(hd2ActiveMatch![0]).toContain('is-active');
    expect(hd2ActiveMatch![1]).toContain('class="status-dot"');

    // Explicit server=zoko
    const resZoko = await app.request('/watch?sub=https://example.com/stream.m3u8&server=zoko');
    const htmlZoko = await resZoko.text();
    const zokoActiveMatch = htmlZoko.match(/<button[^>]*data-server="zoko"[^>]*>([\s\S]*?)<\/button>/);
    expect(zokoActiveMatch).not.toBeNull();
    expect(zokoActiveMatch![0]).toContain('is-active');
    expect(zokoActiveMatch![1]).toContain('class="status-dot"');

    // Explicit server=gogo
    const resGogo = await app.request('/watch?sub=https://example.com/stream.m3u8&server=gogo');
    const htmlGogo = await resGogo.text();
    const gogoActiveMatch = htmlGogo.match(/<button[^>]*data-server="gogo"[^>]*>([\s\S]*?)<\/button>/);
    expect(gogoActiveMatch).not.toBeNull();
    expect(gogoActiveMatch![0]).toContain('is-active');
    expect(gogoActiveMatch![1]).toContain('class="status-dot"');
  });

  it('renders #serverSection inside #settingsMenu with #menuServerChips', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Verify settingsMenu contains serverSection
    expect(html).toContain('id="settingsMenu"');
    expect(html).toContain('id="serverSection"');
    expect(html).toContain('id="menuServerChips"');

    const menuIdx = html.indexOf('id="settingsMenu"');
    const serverSecIdx = html.indexOf('id="serverSection"');
    expect(menuIdx).toBeGreaterThan(-1);
    expect(serverSecIdx).toBeGreaterThan(menuIdx);

    // Verify section header
    expect(html).toMatch(/<div[^>]*id="serverSection"[^>]*>[\s\S]*?<h3>Server<\/h3>/);
  });

  it('includes CSS for responsive layout, touch targets >= 44px, status dot, and theater mode', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // CSS styling rules
    expect(html).toContain('.server-bar');
    expect(html).toContain('.server-chips');
    expect(html).toContain('.status-dot');

    // Status dot 6px green accent with glowing box shadow
    expect(html).toContain('width: 6px');
    expect(html).toContain('height: 6px');
    expect(html).toContain('border-radius: 50%');
    expect(html).toContain('box-shadow: 0 0 8px');

    // Hidden in theater mode
    expect(html).toContain('body.theater .server-bar { display: none; }');

    // Touch targets >= 44x44px for server chips on mobile / coarse pointers
    expect(html).toContain('min-height: 44px');
    expect(html).toContain('min-width: 44px');
  });

  it('includes client script synchronization and dynamic audio filter logic', async () => {
    const app = createTestApp();
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();

    // Script should have sync logic between serverChips and menuServerChips
    expect(html).toContain('syncServerChips');
    expect(html).toContain('menuServerChips');
    expect(html).toContain('updateServerAvailability');

    // When loaded with Dub-only, Zoko should be hidden/unavailable
    const resDub = await app.request('/watch?dub=https://example.com/stream.m3u8&t=dub');
    const htmlDub = await resDub.text();
    const zokoDubMatch = htmlDub.match(/<button[^>]*data-server="zoko"[^>]*>/);
    expect(zokoDubMatch).not.toBeNull();
    expect(zokoDubMatch![0]).toMatch(/hidden|disabled/);
  });
});

import { test, expect } from '@playwright/test';

test.describe('Mobile Player Drawers (Portrait vs Landscape)', () => {
  const watchUrl =
    '/api/v2/hianime/watch?sub=https://megacloud.blog/embed-2/e-1/hls.m3u8&title=Mobile+Drawer+Test';

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v2/hianime/hls*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.apple.mpegurl',
        body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n',
      });
    });
  });

  test('portrait shows bottom sheet <= 85dvh', async ({ page }) => {
    // Ensure portrait viewport (<= 720px width)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(watchUrl);

    const settingsBtn = page.locator('#settingsBtn');
    const menu = page.locator('#settingsMenu');

    await settingsBtn.click();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveClass(/is-open/);

    const viewport = page.viewportSize()!;
    const box = (await menu.boundingBox())!;
    expect(box).not.toBeNull();

    // In portrait, menu is anchored to bottom (bottom sheet)
    expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 2);

    // Menu width spans viewport (100vw)
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);

    // Height must be <= 85dvh (85% of viewport height)
    const maxAllowedHeight = viewport.height * 0.85 + 2;
    expect(box.height).toBeLessThanOrEqual(maxAllowedHeight);
  });

  test('landscape shows right-side drawer height <= 390px, width <= 340px', async ({ page }) => {
    // Set landscape phone viewport (height <= 540px)
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(watchUrl);

    const settingsBtn = page.locator('#settingsBtn');
    const menu = page.locator('#settingsMenu');

    await settingsBtn.click();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveClass(/is-open/);

    const viewport = page.viewportSize()!;
    const box = (await menu.boundingBox())!;
    expect(box).not.toBeNull();

    // Height <= 390px (100dvh in landscape)
    expect(Math.round(box.height)).toBeLessThanOrEqual(390);

    // Width <= 340px (min(340px, 45vw), accounting for deviceScaleFactor subpixel rounding)
    expect(Math.round(box.width)).toBeLessThanOrEqual(340);

    // Positioned at top-right
    expect(box.y).toBeLessThanOrEqual(2);
    expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 2);
  });

  test('backdrop sits behind menu with zero blur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(watchUrl);

    const settingsBtn = page.locator('#settingsBtn');
    const menu = page.locator('#settingsMenu');
    const backdrop = page.locator('#sheetBackdrop');

    await settingsBtn.click();
    await expect(menu).toBeVisible();
    await expect(backdrop).toBeVisible();
    await expect(backdrop).toHaveClass(/is-active/);

    // Backdrop sits behind menu: z-index(backdrop) < z-index(menu)
    const backdropZ = await backdrop.evaluate(el =>
      parseInt(window.getComputedStyle(el).zIndex, 10)
    );
    const menuZ = await menu.evaluate(el => parseInt(window.getComputedStyle(el).zIndex, 10));
    expect(backdropZ).toBeLessThan(menuZ);
    expect(backdropZ).toBe(90);
    expect(menuZ).toBe(100);

    // Backdrop has zero blur (backdrop-filter: none)
    const backdropFilter = await backdrop.evaluate(
      el =>
        window.getComputedStyle(el).backdropFilter ||
        (window.getComputedStyle(el) as any).webkitBackdropFilter ||
        'none'
    );
    expect(backdropFilter).toBe('none');

    // Dialog text is crisp and unblurred
    const menuFilter = await menu.evaluate(el => window.getComputedStyle(el).filter);
    expect(menuFilter === 'none' || menuFilter === '').toBe(true);

    const headTextFilter = await page
      .locator('.sheet-head h3')
      .evaluate(el => window.getComputedStyle(el).filter);
    expect(headTextFilter === 'none' || headTextFilter === '').toBe(true);
  });
});

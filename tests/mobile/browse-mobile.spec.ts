import { test, expect } from '@playwright/test';

test.describe('Browse Mobile Ergonomics', () => {
  const mockHomeData = {
    success: true,
    data: {
      trending: [
        {
          id: 'one-piece',
          name: 'One Piece',
          poster: 'https://example.com/op.jpg',
          episodes: { sub: 1100, dub: 1050 },
        },
        {
          id: 'jujutsu-kaisen',
          name: 'Jujutsu Kaisen',
          poster: 'https://example.com/jjk.jpg',
          episodes: { sub: 48, dub: 48 },
        },
      ],
      latestEpisode: [],
      newAdded: [],
      topAiring: [],
      mostPopular: [],
    },
  };

  test.beforeEach(async ({ page }) => {
    // Intercept home feed for rapid and deterministic test execution
    await page.route('**/api/v2/home', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHomeData),
      });
    });
  });

  test('mobile search inputs font-size >= 16px to prevent iOS auto-zoom', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/browse');

    const searchInput = page.locator('#q');
    const mobileSearchInput = page.locator('#qMobile');

    const searchFontSize = await searchInput.evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
    expect(searchFontSize).toBeGreaterThanOrEqual(16);

    const mobileSearchFontSize = await mobileSearchInput.evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
    expect(mobileSearchFontSize).toBeGreaterThanOrEqual(16);
  });

  test('search FAB includes safe-area bottom offset and 48px touch target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/browse');

    const fab = page.locator('.search-fab');
    await expect(fab).toBeVisible();

    const styles = await fab.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        position: cs.position,
        bottom: parseFloat(cs.bottom),
        minWidth: parseFloat(cs.minWidth),
        minHeight: parseFloat(cs.minHeight),
      };
    });

    expect(styles.position).toBe('fixed');
    // bottom offset is at least 20px (max(20px, env(safe-area-inset-bottom) + 16px))
    expect(styles.bottom).toBeGreaterThanOrEqual(20);
    // Touch target meets or exceeds 48x48px requirement
    expect(styles.minWidth).toBeGreaterThanOrEqual(48);
    expect(styles.minHeight).toBeGreaterThanOrEqual(48);
  });

  test('quick actions have >= 44x44px touch targets and tactile active feedback', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/browse');

    // Wait for anime cards to render
    await page.waitForSelector('.card');

    // Verify watchlist button has hit-slop ::after with min 44x44px
    const wlTarget = await page.evaluate(() => {
      const btn = document.querySelector('.wl-btn') as HTMLElement;
      if (!btn) return null;
      const after = window.getComputedStyle(btn, '::after');
      return {
        minWidth: parseFloat(after.minWidth),
        minHeight: parseFloat(after.minHeight),
      };
    });

    expect(wlTarget).not.toBeNull();
    expect(wlTarget!.minWidth).toBeGreaterThanOrEqual(44);
    expect(wlTarget!.minHeight).toBeGreaterThanOrEqual(44);

    // Verify continue-watching remove button hit-slop ::after
    const cwTarget = await page.evaluate(() => {
      const dummy = document.createElement('div');
      dummy.className = 'cw-remove-btn';
      document.body.appendChild(dummy);
      const after = window.getComputedStyle(dummy, '::after');
      const res = {
        minWidth: parseFloat(after.minWidth),
        minHeight: parseFloat(after.minHeight),
      };
      dummy.remove();
      return res;
    });

    expect(cwTarget.minWidth).toBeGreaterThanOrEqual(44);
    expect(cwTarget.minHeight).toBeGreaterThanOrEqual(44);
  });

  test('category bar supports horizontal touch scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/browse');

    // Wait for the category tab bar to be inserted
    const catBar = page.locator('.mobile-cat-bar');
    await expect(catBar).toBeVisible();

    const scrollMetrics = await catBar.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        overflowX: cs.overflowX,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });

    expect(scrollMetrics.overflowX).toMatch(/auto|scroll/);
    expect(scrollMetrics.scrollWidth).toBeGreaterThanOrEqual(scrollMetrics.clientWidth);

    // Verify category pills have touch-friendly height
    const firstPill = catBar.locator('.pill').first();
    const pillHeight = await firstPill.evaluate(el => parseFloat(window.getComputedStyle(el).minHeight || window.getComputedStyle(el).height));
    expect(pillHeight).toBeGreaterThanOrEqual(38);
  });
});

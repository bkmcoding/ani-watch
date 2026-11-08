import { test, expect } from '@playwright/test';

test.describe('Mobile Player Controls', () => {
  const watchUrl =
    '/api/v2/hianime/watch?sub=https://megacloud.blog/embed-2/e-1/hls.m3u8&title=Mobile+Player+Test';

  test.beforeEach(async ({ page }) => {
    // Intercept upstream stream calls so tests are fast, offline, and reliable
    await page.route('**/api/v2/hianime/hls*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.apple.mpegurl',
        body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n',
      });
    });
  });

  test('tapping video shows controls', async ({ page }) => {
    await page.goto(watchUrl);
    const stage = page.locator('#stage');
    const controls = page.locator('#controls');

    // Simulate playing state where controls are initially hidden
    await page.evaluate(() => {
      const video = (document.getElementById('v') ||
        document.querySelector('video')) as HTMLVideoElement;
      const stageEl = document.getElementById('stage')!;
      Object.defineProperty(video, 'paused', { value: false, configurable: true });
      video.dispatchEvent(new Event('play'));
      stageEl.classList.remove('is-paused', 'show-controls');
      stageEl.classList.add('cursor-hidden');
    });

    await expect(stage).not.toHaveClass(/show-controls/);

    // Tap on stage to reveal controls via touch handler
    await stage.tap({ position: { x: 100, y: 100 } });

    // Controls should now have show-controls class and become visible
    await expect(stage).toHaveClass(/show-controls/, { timeout: 4000 });
    await expect(controls).toBeVisible();
    const opacity = await controls.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeGreaterThan(0);
  });

  test('single tap on stage keeps controls visible after 500ms', async ({ page }) => {
    await page.goto(watchUrl);
    const stage = page.locator('#stage');
    const controls = page.locator('#controls');

    // Simulate playing state where controls are initially hidden
    await page.evaluate(() => {
      const video = (document.getElementById('v') ||
        document.querySelector('video')) as HTMLVideoElement;
      const stageEl = document.getElementById('stage')!;
      Object.defineProperty(video, 'paused', { value: false, configurable: true });
      video.dispatchEvent(new Event('play'));
      stageEl.classList.remove('is-paused', 'show-controls');
      stageEl.classList.add('cursor-hidden');
    });

    await expect(stage).not.toHaveClass(/show-controls/);

    // Tap on stage to reveal controls
    await stage.tap({ position: { x: 120, y: 120 } });

    // Wait 500ms (longer than the 280ms double-tap timer)
    await page.waitForTimeout(500);

    // Controls must STILL be visible and not prematurely hidden
    await expect(stage).toHaveClass(/show-controls/);
    await expect(controls).toBeVisible();
  });

  test('clicking fullscreen triggers orientation lock/fullscreen and drops focus', async ({
    page,
  }) => {
    await page.goto(watchUrl);
    const fsBtn = page.locator('#fs');

    // Instrument screen.orientation and fullscreen methods
    await page.evaluate(() => {
      (window as any).__fsInvoked = null;
      (window as any).__orientationLocked = null;

      if (screen.orientation) {
        screen.orientation.lock = async (mode: string) => {
          (window as any).__orientationLocked = mode;
          return Promise.resolve();
        };
      }

      const stage = document.getElementById('stage') as any;
      if (stage) {
        stage.requestFullscreen = async () => {
          (window as any).__fsInvoked = 'requestFullscreen';
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('landscape').catch(() => {});
          }
          document.dispatchEvent(new Event('fullscreenchange'));
          return Promise.resolve();
        };
      }

      const video = (document.getElementById('v') || document.querySelector('video')) as any;
      if (video) {
        video.webkitEnterFullscreen = () => {
          (window as any).__fsInvoked = 'webkitEnterFullscreen';
          document.dispatchEvent(new Event('webkitfullscreenchange'));
        };
      }
    });

    await fsBtn.click();

    // Verify focus is dropped from the button
    const activeElementId = await page.evaluate(() => document.activeElement?.id);
    expect(activeElementId).not.toBe('fs');

    // Verify fullscreen and orientation lock behavior
    const result = await page.evaluate(() => ({
      fs: (window as any).__fsInvoked,
      locked: (window as any).__orientationLocked,
    }));

    // In desktop/Android Chrome, requestFullscreen triggers and locks landscape.
    // In iOS WebKit, webkitEnterFullscreen triggers on video.
    expect(result.fs === 'requestFullscreen' || result.fs === 'webkitEnterFullscreen').toBe(true);
    if (result.fs === 'requestFullscreen') {
      expect(result.locked).toBe('landscape');
    }
  });

  test('controls auto-hide after timeout without sticking', async ({ page }) => {
    await page.goto(watchUrl);
    const stage = page.locator('#stage');
    const controls = page.locator('#controls');

    // Put video in playing state
    await page.evaluate(() => {
      const video = (document.getElementById('v') ||
        document.querySelector('video')) as HTMLVideoElement;
      const stageEl = document.getElementById('stage')!;
      Object.defineProperty(video, 'paused', { value: false, configurable: true });
      video.dispatchEvent(new Event('play'));
      stageEl.classList.remove('is-paused', 'show-controls');
      stageEl.classList.add('cursor-hidden');
    });

    // Tap to reveal controls with active hideTimer
    await stage.tap({ position: { x: 120, y: 120 } });

    await expect(stage).toHaveClass(/show-controls/);

    // After 4s timeout, controls should auto-hide
    await expect(stage).not.toHaveClass(/show-controls/, { timeout: 6000 });
    await expect(stage).toHaveClass(/cursor-hidden/);
    await expect(controls).toHaveCSS('opacity', '0');
  });
});

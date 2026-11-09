import { test, expect } from '@playwright/test';

test.describe('Mobile Player Touch Gestures & Hold Speed Boost', () => {
  const watchUrl =
    '/api/v2/hianime/watch?sub=https://megacloud.blog/embed-2/e-1/hls.m3u8&title=Mobile+Gesture+Test';

  test.beforeEach(async ({ page }) => {
    // Intercept upstream stream calls so tests are fast, offline, and reliable
    await page.route('**/api/v2/hianime/hls*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.apple.mpegurl',
        body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n',
      });
    });
    await page.route('https://megacloud.blog/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.apple.mpegurl',
        body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n',
      });
    });
  });

  async function setupPlayingVideo(page: any, initialTime = 50, duration = 120) {
    await page.waitForSelector('#stage');
    await page.waitForSelector('#v');
    await page.evaluate(
      ({ initialTime, duration }: { initialTime: number; duration: number }) => {
        const video = (document.getElementById('v') ||
          document.querySelector('video')) as HTMLVideoElement;
        const stageEl = document.getElementById('stage')!;
        Object.defineProperty(video, 'paused', { value: false, configurable: true });
        Object.defineProperty(video, 'duration', { value: duration, configurable: true });
        video.currentTime = initialTime;
        video.dispatchEvent(new Event('play'));
        stageEl.classList.remove('is-paused', 'is-loading', 'show-controls');
        stageEl.classList.add('cursor-hidden');
      },
      { initialTime, duration }
    );
  }

  async function triggerTouchTap(page: any, clientX: number, clientY: number) {
    await page.evaluate(
      ({ clientX, clientY }: { clientX: number; clientY: number }) => {
        const stage = document.getElementById('stage')!;
        const makeTouch = () => {
          try {
            return new Touch({ identifier: 1, target: stage, clientX, clientY });
          } catch (e) {
            return {
              identifier: 1,
              target: stage,
              clientX,
              clientY,
              pageX: clientX,
              pageY: clientY,
            };
          }
        };
        const dispatch = (type: string) => {
          const touch = makeTouch();
          let ev: any;
          try {
            ev = new TouchEvent(type, {
              touches: type === 'touchend' ? [] : [touch],
              targetTouches: type === 'touchend' ? [] : [touch],
              changedTouches: [touch],
              bubbles: true,
              cancelable: true,
            });
          } catch (e) {
            ev = document.createEvent('UIEvent');
            ev.initUIEvent(type, true, true, window, 1);
            ev.touches = type === 'touchend' ? [] : [touch];
            ev.targetTouches = type === 'touchend' ? [] : [touch];
            ev.changedTouches = [touch];
          }
          stage.dispatchEvent(ev);
        };
        dispatch('touchstart');
        dispatch('touchend');
      },
      { clientX, clientY }
    );
  }

  test('double-tap left third seeks backward 10s with ripple wave', async ({ page }) => {
    await page.goto(watchUrl);
    const stage = page.locator('#stage');
    const overlay = page.locator('#seekRippleOverlay');
    const rippleLeft = page.locator('.ripple-left');
    const secs = rippleLeft.locator('.ripple-secs');

    await setupPlayingVideo(page, 50, 120);

    const box = (await stage.boundingBox())!;
    const posX = box.x + box.width * 0.15;
    const posY = box.y + box.height * 0.5;

    // Double tap on left third
    await triggerTouchTap(page, posX, posY);
    await page.waitForTimeout(60);
    await triggerTouchTap(page, posX, posY);

    // Verify seek backward by 10s
    await expect.poll(async () => {
      return page.evaluate(() => {
        const v = document.getElementById('v') as HTMLVideoElement;
        return v ? v.currentTime : null;
      });
    }).toBe(40);

    // Verify ripple overlay is visible and active
    await expect(overlay).toBeVisible();
    await expect(rippleLeft).toHaveClass(/is-active/);
    await expect(secs).toHaveText('10');
  });

  test('consecutive double-taps on left third compound seek (10s -> 20s -> 30s)', async ({
    page,
  }) => {
    await page.goto(watchUrl);
    const stage = page.locator('#stage');
    const rippleLeft = page.locator('.ripple-left');
    const secs = rippleLeft.locator('.ripple-secs');

    await setupPlayingVideo(page, 60, 120);

    const box = (await stage.boundingBox())!;
    const posX = box.x + box.width * 0.15;
    const posY = box.y + box.height * 0.5;

    // First double-tap (10s seek)
    await triggerTouchTap(page, posX, posY);
    await page.waitForTimeout(60);
    await triggerTouchTap(page, posX, posY);

    await expect.poll(async () => {
      return page.evaluate(() => (document.getElementById('v') as HTMLVideoElement).currentTime);
    }).toBe(50);
    await expect(secs).toHaveText('10');

    // Third tap within 650ms compounding window (adds another 10s -> 20s total)
    await page.waitForTimeout(120);
    await triggerTouchTap(page, posX, posY);

    await expect.poll(async () => {
      return page.evaluate(() => (document.getElementById('v') as HTMLVideoElement).currentTime);
    }).toBe(40);
    await expect(secs).toHaveText('20');

    // Fourth tap within 650ms (adds another 10s -> 30s total)
    await page.waitForTimeout(120);
    await triggerTouchTap(page, posX, posY);

    await expect.poll(async () => {
      return page.evaluate(() => (document.getElementById('v') as HTMLVideoElement).currentTime);
    }).toBe(30);
    await expect(secs).toHaveText('30');
  });

  test('double-tap right third seeks forward 10s with ripple wave', async ({ page }) => {
    await page.goto(watchUrl);
    const stage = page.locator('#stage');
    const overlay = page.locator('#seekRippleOverlay');
    const rippleRight = page.locator('.ripple-right');
    const secs = rippleRight.locator('.ripple-secs');

    await setupPlayingVideo(page, 30, 120);

    const box = (await stage.boundingBox())!;
    const posX = box.x + box.width * 0.85;
    const posY = box.y + box.height * 0.5;

    // Double tap right third
    await triggerTouchTap(page, posX, posY);
    await page.waitForTimeout(60);
    await triggerTouchTap(page, posX, posY);

    // Verify seek forward by 10s
    await expect.poll(async () => {
      return page.evaluate(() => (document.getElementById('v') as HTMLVideoElement).currentTime);
    }).toBe(40);

    // Verify ripple overlay is visible and right ripple active
    await expect(overlay).toBeVisible();
    await expect(rippleRight).toHaveClass(/is-active/);
    await expect(secs).toHaveText('10');
  });

  test('double-tap center third toggles fullscreen', async ({ page }) => {
    await page.goto(watchUrl);
    const stage = page.locator('#stage');

    await setupPlayingVideo(page, 10, 120);

    // Instrument toggleFs / fullscreen request
    await page.evaluate(() => {
      (window as any).__fsInvoked = false;
      const stageEl = document.getElementById('stage') as any;
      stageEl.requestFullscreen = async () => {
        (window as any).__fsInvoked = true;
        return Promise.resolve();
      };
      const v = document.getElementById('v') as any;
      if (v) {
        v.webkitEnterFullscreen = () => {
          (window as any).__fsInvoked = true;
        };
      }
    });

    const box = (await stage.boundingBox())!;
    const posX = box.x + box.width * 0.5;
    const posY = box.y + box.height * 0.5;

    // Double tap center
    await triggerTouchTap(page, posX, posY);
    await page.waitForTimeout(60);
    await triggerTouchTap(page, posX, posY);

    await expect.poll(async () => {
      return page.evaluate(() => (window as any).__fsInvoked);
    }).toBe(true);
  });

  test('press-and-hold > 400ms temporarily boosts playback rate to 2.0x with speed pill', async ({
    page,
  }) => {
    await page.goto(watchUrl);
    const speedPill = page.locator('#holdSpeedPill');

    await setupPlayingVideo(page, 10, 120);

    // Initial playback rate is 1.0
    await page.evaluate(() => {
      const v = document.getElementById('v') as HTMLVideoElement;
      v.playbackRate = 1.0;
    });

    // Helper to dispatch cross-browser touch event on stage
    const dispatchTouch = (type: string, clientX?: number, clientY?: number) => {
      return page.evaluate(
        ({ type, clientX, clientY }: { type: string; clientX?: number; clientY?: number }) => {
          const stage = document.getElementById('stage')!;
          const rect = stage.getBoundingClientRect();
          const x = typeof clientX === 'number' ? clientX : rect.left + rect.width / 2;
          const y = typeof clientY === 'number' ? clientY : rect.top + rect.height / 2;

          let touch: any;
          try {
            touch = new Touch({ identifier: 1, target: stage, clientX: x, clientY: y });
          } catch (e) {
            touch = { identifier: 1, target: stage, clientX: x, clientY: y, pageX: x, pageY: y };
          }

          let ev: any;
          try {
            ev = new TouchEvent(type, {
              touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
              targetTouches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
              changedTouches: [touch],
              bubbles: true,
              cancelable: true,
            });
          } catch (e) {
            ev = document.createEvent('UIEvent');
            ev.initUIEvent(type, true, true, window, 1);
            ev.touches = type === 'touchend' || type === 'touchcancel' ? [] : [touch];
            ev.targetTouches = type === 'touchend' || type === 'touchcancel' ? [] : [touch];
            ev.changedTouches = [touch];
          }
          stage.dispatchEvent(ev);
        },
        { type, clientX, clientY }
      );
    };

    // Dispatch touchstart
    await dispatchTouch('touchstart');

    // Wait 450ms (> 400ms hold threshold)
    await page.waitForTimeout(450);

    // Verify speed boosted to 2.0x and speed pill visible
    const boostedRate = await page.evaluate(
      () => (document.getElementById('v') as HTMLVideoElement).playbackRate
    );
    expect(boostedRate).toBe(2.0);
    await expect(speedPill).toBeVisible();
    await expect(speedPill).toHaveText(/2x ▶▶/);

    // Release finger via touchend
    await dispatchTouch('touchend');

    // Speed restored and pill hidden
    const restoredRate = await page.evaluate(
      () => (document.getElementById('v') as HTMLVideoElement).playbackRate
    );
    expect(restoredRate).toBe(1.0);
    await expect(speedPill).toBeHidden();
  });

  test('dragging finger > 10px cancels press-and-hold speed boost', async ({ page }) => {
    await page.goto(watchUrl);
    const speedPill = page.locator('#holdSpeedPill');

    await setupPlayingVideo(page, 10, 120);

    await page.evaluate(() => {
      const stage = document.getElementById('stage')!;
      const rect = stage.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;

      const makeTouch = (x: number, y: number) => {
        try {
          return new Touch({ identifier: 1, target: stage, clientX: x, clientY: y });
        } catch (e) {
          return { identifier: 1, target: stage, clientX: x, clientY: y, pageX: x, pageY: y };
        }
      };

      const dispatch = (type: string, touch: any) => {
        let ev: any;
        try {
          ev = new TouchEvent(type, {
            touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
            targetTouches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
            changedTouches: [touch],
            bubbles: true,
            cancelable: true,
          });
        } catch (e) {
          ev = document.createEvent('UIEvent');
          ev.initUIEvent(type, true, true, window, 1);
          ev.touches = type === 'touchend' || type === 'touchcancel' ? [] : [touch];
          ev.targetTouches = type === 'touchend' || type === 'touchcancel' ? [] : [touch];
          ev.changedTouches = [touch];
        }
        stage.dispatchEvent(ev);
      };

      dispatch('touchstart', makeTouch(startX, startY));
      dispatch('touchmove', makeTouch(startX + 25, startY + 25));
    });

    // Wait 450ms
    await page.waitForTimeout(450);

    // Playback rate should NOT be boosted to 2.0
    const rate = await page.evaluate(
      () => (document.getElementById('v') as HTMLVideoElement).playbackRate
    );
    expect(rate).not.toBe(2.0);
    await expect(speedPill).toBeHidden();

    // Clean up touch
    await page.evaluate(() => {
      const stage = document.getElementById('stage')!;
      stage.dispatchEvent(new Event('touchcancel'));
    });
  });
});

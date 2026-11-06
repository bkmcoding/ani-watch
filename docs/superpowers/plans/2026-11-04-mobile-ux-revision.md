# Mobile UX Revision & Automated Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an accessible, touch-optimized mobile experience across `ani.watch` (`/watch` and `/browse`), fixing fullscreen auto-rotation, controls sticking, settings overflow and backdrop blur bugs, backed by an automated Playwright mobile test suite.

**Architecture:** Dual-mode fullscreen handler (Screen Orientation API + iOS Safari `webkitEnterFullscreen`), focus-scoped touch HUD controls auto-hiding, adaptive drawer system (portrait bottom sheet & landscape right slide-over), iOS auto-zoom prevention, and an automated Playwright multi-device mobile test suite.

**Tech Stack:** TypeScript, Hono, Vanilla CSS / DOM, Playwright E2E, Vitest, Node/Vercel esbuild.

**Spec:** [`docs/superpowers/specs/2026-11-04-mobile-ux-revision-design.md`](file:///c:/Users/orkar/Documents/GitHub/ani-watch/docs/superpowers/specs/2026-11-04-mobile-ux-revision-design.md)

## Global Constraints
- Target Branch: `feat/mobile-ux-revision`
- Minimum touch target: 44×44px for buttons and interactive icons (WCAG 2.5.5 / 2.5.8)
- Safe Area insets: Always respect `env(safe-area-inset-*)`
- Zero unintended viewport zoom on iOS Safari: Inputs and selects must maintain `>= 16px` font-size on screens `<= 720px`
- Preserved existing Vitest test suite passing at all times

---

### Task 1: Fix Controls Sticking & Focus Retaining on Mobile

**Files:**
- Modify: `src/handlers/pages/watch.ts:600-620`, `src/handlers/pages/watch.ts:2700-2760`
- Test: `tests/security/headers.test.ts` / mobile test harness

**Interfaces:**
- Consumes: `stage`, `controls`, `hideTimer`, `pokeControls`
- Produces: CSS rules scoping `:focus-within` to mouse/keyboard; JS touch handlers blurring clicked buttons and single-tap hiding controls

- [ ] **Step 1: Write unit test validating CSS focus-scoping and control visibility rules**

Add a test in `tests/handlers/watchControlsMobile.test.ts` verifying that `.controls` CSS output contains `@media (hover: hover)` or `:focus-visible` scoping and doesn't expose unbounded `:focus-within` for coarse touch pointers.

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Mobile Controls CSS & Scoping', () => {
  it('scopes :focus-within to hover-capable or focus-visible devices', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('@media (hover: hover)');
    expect(html).not.toMatch(/\.stage:focus-within\s*\.controls\s*\{\s*opacity:\s*1/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/watchControlsMobile.test.ts`
Expected: FAIL (unbounded `.stage:focus-within .controls` currently exists)

- [ ] **Step 3: Implement minimal code to scope focus and blur buttons on tap**

In `src/handlers/pages/watch.ts`:
1. In the stylesheet:
```css
    @media (hover: hover) {
      .stage:focus-within .controls {
        opacity: 1; transform: translateY(0);
        pointer-events: auto;
      }
    }
    .stage:has(:focus-visible) .controls {
      opacity: 1; transform: translateY(0);
      pointer-events: auto;
    }
```
2. In JS stage pointer/touch handlers:
- In control button click handlers (`playBtn`, `bigPlay`, `muteBtn`, `fsBtn`, `settingsBtn`, `epListBtn`, `speedBtn`), call:
  `if (window.matchMedia('(pointer: coarse)').matches) this.blur();`
- When tapping the stage in coarse touch:
  If controls are shown and video is playing, immediately hide them:
  ```js
  if (stage.classList.contains('show-controls') && !video.paused) {
    clearTimeout(hideTimer);
    stage.classList.remove('show-controls');
    stage.classList.add('cursor-hidden');
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/watchControlsMobile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/watch.ts tests/handlers/watchControlsMobile.test.ts
git commit -m "fix(watch): scope focus-within to prevent mobile controls from sticking"
```

---

### Task 2: Fix Settings Backdrop Layering & Screen Blurring Bug

**Files:**
- Modify: `src/handlers/pages/watch.ts:700-720`, `src/handlers/pages/watch.ts:875-900`, `src/handlers/pages/watch.ts:1120-1175`
- Test: `tests/handlers/watchBackdropMobile.test.ts`

**Interfaces:**
- Consumes: `#sheetBackdrop`, `#settingsMenu`, `#epPanel`
- Produces: Normalized z-indexes (`z-index: 90` for backdrop, `z-index: 100` for dialogs), suppression of backdrop on desktop (`min-width: 721px` & height > 540px), zero-blur backdrop scrim

- [ ] **Step 1: Write test verifying backdrop suppression on desktop and z-index ordering**

Create `tests/handlers/watchBackdropMobile.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Settings Backdrop & Layering', () => {
  it('suppresses sheet-backdrop on desktop and sets safe z-index hierarchy', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    // Backdrop must be hidden on desktop
    expect(html).toContain('@media (min-width: 721px)');
    // Backdrop must not blur dialogs
    expect(html).not.toMatch(/\.sheet-backdrop\s*\{[^}]*backdrop-filter:\s*blur/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/watchBackdropMobile.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement clean backdrop layering and blur elimination**

In `src/handlers/pages/watch.ts`:
1. Default `.sheet-backdrop`:
```css
    .sheet-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      z-index: 90;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s var(--ease);
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
```
2. Ensure desktop suppresses backdrop completely:
```css
    @media (min-width: 721px) and (min-height: 541px) {
      .sheet-backdrop {
        display: none !important;
        pointer-events: none !important;
      }
    }
```
3. Set `.menu` and `.ep-panel` z-index to `100` so they are always physically rendered above the backdrop.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/watchBackdropMobile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/watch.ts tests/handlers/watchBackdropMobile.test.ts
git commit -m "fix(watch): resolve settings backdrop layering bug and eliminate screen blur"
```

---

### Task 3: Implement Dual-Mode Fullscreen & Orientation Auto-Rotation

**Files:**
- Modify: `src/handlers/pages/watch.ts:1930-1960`, `src/handlers/pages/watch.ts:2750-2770`
- Test: `tests/handlers/watchFullscreenOrientation.test.ts`

**Interfaces:**
- Consumes: `screen.orientation`, `video.webkitEnterFullscreen`, `stage.requestFullscreen`, `document.exitFullscreen`
- Produces: Automatic landscape orientation locking on supported browsers, iOS native fallback, `fullscreenchange` event listener syncing `#fs` button icon and title

- [ ] **Step 1: Write test validating orientation lock & fullscreen change hooks**

Create `tests/handlers/watchFullscreenOrientation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Fullscreen & Orientation Handlers', () => {
  it('includes Screen Orientation API and fullscreenchange synchronization', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('screen.orientation.lock');
    expect(html).toContain('fullscreenchange');
    expect(html).toContain('webkitendfullscreen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/watchFullscreenOrientation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement toggleFs with Screen Orientation API, iOS fallback, and fullscreenchange sync**

In `src/handlers/pages/watch.ts`:
1. In `toggleFs()`:
```javascript
      function isIosPhone() {
        return /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      }

      function toggleFs() {
        var isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        if (!isFs) {
          if (settingsMenu && settingsMenu.classList.contains('is-open')) toggleSettings(false);
          if (epPanel && epPanel.classList.contains('is-open')) setEpPanel(false);

          if (isIosPhone() && typeof video.webkitEnterFullscreen === 'function' && !stage.requestFullscreen) {
            video.webkitEnterFullscreen();
            return;
          }

          var req = stage.requestFullscreen || stage.webkitRequestFullscreen;
          if (req) {
            req.call(stage).then(function () {
              if (screen.orientation && typeof screen.orientation.lock === 'function') {
                screen.orientation.lock('landscape').catch(function () {});
              }
            }).catch(function () {});
          }
        } else {
          var exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) {
            exit.call(document).then(function () {
              if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
              }
            }).catch(function () {});
          }
        }
      }
```
2. Listen to `fullscreenchange`, `webkitfullscreenchange`, and `video.addEventListener('webkitendfullscreen')`:
```javascript
      function onFsChange() {
        var isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        stage.classList.toggle('is-fullscreen', isFs);
        document.body.classList.toggle('is-fullscreen', isFs);
        fsBtn.setAttribute('title', isFs ? 'Exit Fullscreen (F)' : 'Fullscreen (F)');
        fsBtn.setAttribute('aria-label', isFs ? 'Exit Fullscreen' : 'Fullscreen');
        fsBtn.innerHTML = isFs
          ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z"/></svg>'
          : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
        if (!isFs && screen.orientation && typeof screen.orientation.unlock === 'function') {
          screen.orientation.unlock();
        }
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        pokeControls();
      }
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      video.addEventListener('webkitendfullscreen', onFsChange);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/watchFullscreenOrientation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/watch.ts tests/handlers/watchFullscreenOrientation.test.ts
git commit -m "feat(watch): add Screen Orientation API auto-rotation and fullscreen state sync"
```

---

### Task 4: Implement Adaptive Settings & Episode Drawer System

**Files:**
- Modify: `src/handlers/pages/watch.ts:1140-1280`
- Test: `tests/handlers/watchAdaptiveDrawers.test.ts`

**Interfaces:**
- Consumes: `.menu`, `.ep-panel`, media queries for portrait and landscape
- Produces: Bottom sheet styles in portrait mobile; right slide-over panel styles in landscape phone (`max-height: 540px`)

- [ ] **Step 1: Write test verifying portrait bottom sheet and landscape side drawer media rules**

Create `tests/handlers/watchAdaptiveDrawers.test.ts`:
```ts
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/watchAdaptiveDrawers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement adaptive portrait bottom sheet and landscape right slide-over**

In `src/handlers/pages/watch.ts`:
1. Portrait mobile bottom sheet:
```css
    @media (max-width: 720px) and (orientation: portrait), (max-width: 540px) {
      .menu, .ep-panel {
        position: fixed !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        top: auto !important;
        width: 100vw !important;
        max-width: 100vw !important;
        max-height: min(85dvh, 560px) !important;
        border-radius: 20px 20px 0 0 !important;
        border: none !important;
        border-top: 1px solid rgba(255, 255, 255, 0.16) !important;
        transform: translateY(100%) !important;
        transition: transform 0.28s var(--ease), opacity 0.2s ease !important;
        z-index: 100 !important;
      }
      .menu.is-open, .ep-panel.is-open {
        transform: translateY(0) !important;
        visibility: visible !important;
      }
    }
```
2. Landscape phone right slide-over drawer:
```css
    @media (max-height: 540px) and (orientation: landscape) {
      .menu, .ep-panel {
        position: fixed !important;
        top: 0 !important;
        bottom: 0 !important;
        right: 0 !important;
        left: auto !important;
        width: min(340px, 45vw) !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 16px 0 0 16px !important;
        border: none !important;
        border-left: 1px solid rgba(255, 255, 255, 0.16) !important;
        transform: translateX(100%) !important;
        transition: transform 0.28s var(--ease), opacity 0.2s ease !important;
        z-index: 100 !important;
        padding-right: max(12px, env(safe-area-inset-right)) !important;
      }
      .menu.is-open, .ep-panel.is-open {
        transform: translateX(0) !important;
        visibility: visible !important;
      }
      .sheet-handle { display: none !important; }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/watchAdaptiveDrawers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/watch.ts tests/handlers/watchAdaptiveDrawers.test.ts
git commit -m "feat(watch): implement adaptive settings and episode drawers for portrait and landscape"
```

---

### Task 5: Browse Page Mobile Ergonomics, iOS Auto-Zoom Prevention & Safe Areas

**Files:**
- Modify: `src/handlers/pages/browse.ts:145-200`, `src/handlers/pages/browse.ts:700-750`, `src/handlers/pages/browse.ts:1260-1300`
- Test: `tests/handlers/browseMobile.test.ts`

**Interfaces:**
- Consumes: `.search-fab`, `.search-dock`, `.mobile-cat-bar`, `.card`, `.wl-btn`
- Produces: `font-size: 16px` on mobile inputs/selects, 44×44px hit-targets, safe area guards

- [ ] **Step 1: Write test verifying browse mobile font-size and safe-area rules**

Create `tests/handlers/browseMobile.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

describe('Browse Mobile Ergonomics', () => {
  it('enforces 16px font-size on mobile inputs and includes safe-area insets', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('safe-area-inset-bottom');
    // Checks that inputs on mobile have 16px font-size
    expect(html).toMatch(/@media\s*\(max-width:\s*720px\)[^}]*input[^}]*font-size:\s*16px/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/browseMobile.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement iOS auto-zoom prevention and safe-area enhancements in browse.ts**

In `src/handlers/pages/browse.ts`:
1. Add mobile input typography rule:
```css
    @media (max-width: 720px) {
      input, select, textarea {
        font-size: 16px !important;
      }
    }
```
2. Ensure `.search-fab` has `min-width: 48px; min-height: 48px; bottom: max(20px, calc(env(safe-area-inset-bottom) + 16px));`
3. Ensure `.wl-btn` and `.cw-remove-btn` have `min-width: 44px; min-height: 44px;` with active tactile scaling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/browseMobile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/browse.ts tests/handlers/browseMobile.test.ts
git commit -m "feat(browse): prevent iOS auto-zoom and enhance mobile touch targets"
```

---

### Task 6: Automated Playwright Mobile E2E Test Suite & NPM Script

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/mobile/player-controls.spec.ts`
- Create: `tests/mobile/player-drawers.spec.ts`
- Create: `tests/mobile/browse-mobile.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Playwright test runner, Hono server instance or mock endpoints
- Produces: `npm run test:mobile` command testing Pixel 7, iPhone 14, and Landscape 844×390 viewports

- [ ] **Step 1: Create `playwright.config.ts`**

Configure Playwright with mobile device projects:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mobile',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node -e "import(\'./api/index.js\')"',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iPhone 14',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'Mobile Landscape',
      use: {
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
});
```

- [ ] **Step 2: Write mobile player controls and auto-hide E2E test**

In `tests/mobile/player-controls.spec.ts`:
- Test that tapping video shows controls.
- Test that tapping fullscreen `#fs` triggers fullscreen and blurs button.
- Test that controls auto-hide after delay without sticking.

- [ ] **Step 3: Write mobile drawer E2E tests (portrait vs landscape)**

In `tests/mobile/player-drawers.spec.ts`:
- In portrait: opening `#settingsBtn` shows `.menu` at bottom with `max-height <= 85dvh`.
- In landscape: opening `#settingsBtn` shows `.menu` at right side with `height <= 390px`.
- Verify `.sheet-backdrop` sits behind `.menu` and dialog text is unblurred.

- [ ] **Step 4: Write browse mobile E2E test**

In `tests/mobile/browse-mobile.spec.ts`:
- Test that mobile search input has font size >= 16px.
- Test category scrolling and touch targets.

- [ ] **Step 5: Add `"test:mobile"` to `package.json`**

In `package.json`:
`"test:mobile": "playwright test tests/mobile"`

- [ ] **Step 6: Run mobile tests to verify they pass**

Run: `npx playwright test tests/mobile`
Expected: All tests pass across Pixel 7, iPhone 14, and Landscape viewports.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts tests/mobile/ package.json
git commit -m "test(mobile): add automated Playwright mobile multi-device test suite"
```

---

### Task 7: Build & Full Verification

**Files:**
- Modify: `api/index.js` (rebuilt via `node build-vercel.mjs`)
- All files touched in Tasks 1–6

**Interfaces:**
- Consumes: `src/`, `build-vercel.mjs`
- Produces: Updated production bundle `api/index.js`, zero type errors, 100% test pass rate

- [ ] **Step 1: Rebundle Vercel entry**

Run: `node build-vercel.mjs`
Expected: Bundled Vercel function → `api/index.js`

- [ ] **Step 2: Run TypeScript type check**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 3: Run full Vitest suite**

Run: `npm test`
Expected: All 64+ unit/integration tests pass

- [ ] **Step 4: Run Playwright mobile test suite**

Run: `npm run test:mobile`
Expected: All mobile scenarios pass cleanly

- [ ] **Step 5: Final commit and git status check**

```bash
git add api/index.js
git commit -m "build(dist): recompile vercel bundle with mobile UX enhancements"
```

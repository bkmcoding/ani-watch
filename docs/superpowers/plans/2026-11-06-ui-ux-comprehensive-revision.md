# Comprehensive UI/UX Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the mobile and desktop user experience across `ani.watch` by fixing the ~0.5s mobile tap controls disappearance bug, adding seek scrub preview and buffer visualization, action OSD pill, keyboard shortcuts modal, episode drawer search, browse debounced search with clear button, 50-episode chunking for long anime, and a modernized landing hero with direct search and continue watching resume card.

**Architecture:** Refactor client-side event loops and DOM rendering templates within Hono page controllers (`src/handlers/pages/watch.ts`, `browse.ts`, `landing.ts`). Enforce clean touch lifecycle states (`wasVisibleAtTouchStart`), lightweight virtual chunking for 1000+ episode series, reactive CSS custom properties (`--buffered`, `--progress`), and unified `localStorage['ani.cw']` reading.

**Tech Stack:** TypeScript, Node.js, Hono, Vanilla Web APIs (DOM, Touch/Pointer Events, Video `buffered` TimeRanges, LocalStorage), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-ui-ux-comprehensive-revision-design.md`

## Global Constraints

- Touch targets must be at least 44×44px (`min-width: 44px; min-height: 44px;`).
- All text inputs on mobile must enforce `font-size: 16px !important` to prevent iOS Safari auto-zoom.
- Safe area insets must be preserved using `env(safe-area-inset-*)`.
- Controller HTML responses must stay lightweight and performant without external runtime client libraries.
- After any page controller modifications, `node build-vercel.mjs` must be run to recompile `api/index.js`.
- All tests (Vitest and Playwright mobile) must pass cleanly before marking complete.

---

### Task 1: Video Player Mobile Tap Lifecycle & Controls State Machine

**Files:**
- Modify: `src/handlers/pages/watch.ts:3280-3320` and `2800-2850`
- Test: `tests/handlers/watchControlsMobile.test.ts`
- E2E Test: `tests/mobile/player-controls.spec.ts`

**Interfaces:**
- Consumes: `#stage`, `#v` (video element), `hideTimer`, `pokeControls()` in `src/handlers/pages/watch.ts`.
- Produces: Reliable single-tap reveal (persisting for 4s of inactivity) and immediate single-tap hide when already open.

- [ ] **Step 1: Write the failing unit and E2E tests for mobile tap lifecycle**

Update `tests/handlers/watchControlsMobile.test.ts` to assert that preemptive `touchstart` poke is removed and replaced with `wasVisibleAtTouchStart` tracking:

```typescript
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

  it('does not attach preemptive touchstart pokeControls that causes flicker', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).not.toContain("stage.addEventListener('touchstart', pokeControls");
    expect(html).toContain('wasVisibleAtTouchStart');
  });

  it('keeps controls open on single tap when hidden and closes on single tap when visible', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('startHideTimer(4000)');
  });
});
```

And in `tests/mobile/player-controls.spec.ts`, add a test verifying controls stay visible after 500ms on mobile:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/watchControlsMobile.test.ts`
Expected: FAIL with `expected html not to contain "stage.addEventListener('touchstart', pokeControls"`

- [ ] **Step 3: Implement minimal fix in `src/handlers/pages/watch.ts`**

1. In `src/handlers/pages/watch.ts`, delete line 3291:
```javascript
// REMOVE:
// stage.addEventListener('touchstart', pokeControls, { passive: true });
```

2. Replace the tap handler around line 2800 with:
```javascript
      var wasVisibleAtTouchStart = false;
      var stageTouchTarget = null;

      stage.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          stageTouchTarget = e.target;
          var inInteractive = !!(e.target && e.target.closest && e.target.closest('.controls, .menu, .ep-panel, .shortcuts-dialog, .seek-wrap, button, input'));
          if (!inInteractive) {
            wasVisibleAtTouchStart = stage.classList.contains('show-controls');
          }
        }
      }, { passive: true });

      function handleStageSingleTap() {
        if (!wasVisibleAtTouchStart) {
          // Controls were hidden -> reveal them and keep open for 4 seconds
          stage.classList.add('show-controls');
          stage.classList.remove('cursor-hidden');
          startHideTimer(4000);
        } else {
          // Controls were visibly open -> single tap on blank area hides them
          if (!video.paused) {
            clearTimeout(hideTimer);
            stage.classList.remove('show-controls');
            stage.classList.add('cursor-hidden');
          }
        }
      }
```

3. Inside `stage.addEventListener('pointerup', ...)` (or `touchend`), call `handleStageSingleTap()` inside the 280ms timer callback if not a double tap.
4. Ensure `startHideTimer(ms)` defaults to 4000ms.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/watchControlsMobile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/watch.ts tests/handlers/watchControlsMobile.test.ts tests/mobile/player-controls.spec.ts
git commit -m "fix(watch): resolve mobile tap controls disappearance bug and stabilize touch lifecycle"
```

---

### Task 2: Video Player Seekbar Scrub Tooltip & Buffered Progress Track

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Create: `tests/handlers/watchSeekBuffer.test.ts`

**Interfaces:**
- Consumes: `.seek-wrap`, `.seek`, `video.buffered`, `video.duration`, `video.currentTime`.
- Produces: `.seek-tooltip` floating indicator and `--buffered` CSS variable on `.seek`.

- [ ] **Step 1: Write the failing test for scrub tooltip and buffer range**

Create `tests/handlers/watchSeekBuffer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch Seekbar Scrub Preview & Buffered Track', () => {
  it('renders seek-tooltip element inside seek-wrap', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('class="seek-tooltip"');
    expect(html).toContain('id="seekTooltip"');
  });

  it('contains CSS styling for multi-layer buffer track and tooltip positioning', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('--buffered');
    expect(html).toContain('.seek-tooltip');
  });

  it('updates --buffered CSS property on progress and timeupdate events', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain("video.buffered");
    expect(html).toContain("seek.style.setProperty('--buffered'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/watchSeekBuffer.test.ts`
Expected: FAIL with `expected html to contain 'class="seek-tooltip"'`

- [ ] **Step 3: Implement minimal code in `src/handlers/pages/watch.ts`**

1. In HTML template inside `.seek-wrap`:
```html
<div class="seek-wrap" id="seekWrap">
  <div class="seek-tooltip" id="seekTooltip">00:00</div>
  <input class="seek" id="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek video" />
</div>
```

2. In CSS inside `watch.ts`:
```css
.seek-wrap {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}
.seek-tooltip {
  position: absolute;
  bottom: 24px;
  left: 0;
  transform: translateX(-50%);
  background: rgba(12, 16, 24, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  white-space: nowrap;
  z-index: 10;
}
.seek-wrap:hover .seek-tooltip,
.seek-wrap.is-scrubbing .seek-tooltip {
  opacity: 1;
}
.seek {
  --progress: 0%;
  --buffered: 0%;
  background: linear-gradient(to right,
    var(--accent) 0%,
    var(--accent) var(--progress),
    rgba(255, 255, 255, 0.35) var(--progress),
    rgba(255, 255, 255, 0.35) var(--buffered),
    rgba(255, 255, 255, 0.12) var(--buffered),
    rgba(255, 255, 255, 0.12) 100%
  );
}
```

3. In client JS:
```javascript
var seekTooltip = document.getElementById('seekTooltip');
var seekWrap = document.getElementById('seekWrap');

function updateBufferTrack() {
  if (!video.duration || !video.buffered || !video.buffered.length) {
    seek.style.setProperty('--buffered', '0%');
    return;
  }
  var dur = video.duration;
  var cur = video.currentTime;
  var bufEnd = 0;
  for (var i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= cur && video.buffered.end(i) >= cur) {
      bufEnd = video.buffered.end(i);
      break;
    }
    if (video.buffered.end(i) > bufEnd) bufEnd = video.buffered.end(i);
  }
  var pct = Math.min(100, Math.max(0, (bufEnd / dur) * 100));
  seek.style.setProperty('--buffered', pct.toFixed(1) + '%');
}

video.addEventListener('progress', updateBufferTrack);
video.addEventListener('timeupdate', updateBufferTrack);

function updateScrubTooltip(clientX) {
  if (!seekWrap || !seekTooltip || !video.duration) return;
  var rect = seekWrap.getBoundingClientRect();
  var frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  var time = frac * video.duration;
  seekTooltip.textContent = formatTime(time);
  seekTooltip.style.left = (frac * 100).toFixed(1) + '%';
}

seekWrap.addEventListener('pointermove', function (e) {
  updateScrubTooltip(e.clientX);
});
seekWrap.addEventListener('touchmove', function (e) {
  if (e.touches && e.touches[0]) updateScrubTooltip(e.touches[0].clientX);
}, { passive: true });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/watchSeekBuffer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/watch.ts tests/handlers/watchSeekBuffer.test.ts
git commit -m "feat(watch): add interactive seekbar scrub preview tooltip and multi-layer buffer visualization"
```

---

### Task 3: Action & Volume OSD HUD, Keyboard Shortcuts Dialog, and Episode Drawer Filter

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Create: `tests/handlers/watchOsdShortcuts.test.ts`

**Interfaces:**
- Consumes: keyboard events, volume changes, speed changes, episode list.
- Produces: `#actionOsd`, `#shortcutsModal`, `#epSearchInput`.

- [ ] **Step 1: Write the failing test for OSD, Shortcuts dialog, and Episode search**

Create `tests/handlers/watchOsdShortcuts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { watchController } from '../../src/handlers/pages/watch';

describe('Watch OSD, Shortcuts Dialog & Episode Filter', () => {
  it('renders Action OSD HUD element at top-center', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('id="actionOsd"');
    expect(html).toContain('class="action-osd"');
  });

  it('renders Keyboard Shortcuts dialog with accessible attributes', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('id="shortcutsModal"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Keyboard Shortcuts');
  });

  it('renders episode search/filter input in episode drawer', async () => {
    const app = new Hono();
    app.get('/watch', watchController);
    const res = await app.request('/watch?sub=https://example.com/stream.m3u8');
    const html = await res.text();
    expect(html).toContain('id="epSearchInput"');
    expect(html).toContain('placeholder="Filter episodes');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/watchOsdShortcuts.test.ts`
Expected: FAIL with `expected html to contain 'id="actionOsd"'`

- [ ] **Step 3: Implement minimal code in `src/handlers/pages/watch.ts`**

1. Add `#actionOsd` inside `#stage`:
```html
<div class="action-osd" id="actionOsd" aria-live="polite" aria-atomic="true">
  <span class="osd-icon" id="osdIcon"></span>
  <span class="osd-text" id="osdText"></span>
</div>
```

2. Add `#shortcutsModal` dialog template:
```html
<div class="modal-backdrop" id="shortcutsBackdrop" aria-hidden="true"></div>
<div class="shortcuts-modal" id="shortcutsModal" role="dialog" aria-modal="true" aria-labelledby="shortcutsTitle" aria-hidden="true">
  <div class="shortcuts-head">
    <h3 id="shortcutsTitle">Keyboard Shortcuts</h3>
    <button type="button" class="btn-icon" id="shortcutsClose" aria-label="Close shortcuts">✕</button>
  </div>
  <div class="shortcuts-body">
    <div class="shortcut-row"><kbd>Space</kbd> / <kbd>K</kbd> <span>Play / Pause</span></div>
    <div class="shortcut-row"><kbd>J</kbd> / <kbd>L</kbd> <span>Seek -10s / +10s</span></div>
    <div class="shortcut-row"><kbd>←</kbd> / <kbd>→</kbd> <span>Seek -5s / +5s</span></div>
    <div class="shortcut-row"><kbd>↑</kbd> / <kbd>↓</kbd> <span>Volume Up / Down</span></div>
    <div class="shortcut-row"><kbd>M</kbd> <span>Mute / Unmute</span></div>
    <div class="shortcut-row"><kbd>F</kbd> <span>Toggle Fullscreen</span></div>
    <div class="shortcut-row"><kbd>C</kbd> <span>Toggle Captions</span></div>
    <div class="shortcut-row"><kbd>[</kbd> / <kbd>]</kbd> <span>Previous / Next Episode</span></div>
    <div class="shortcut-row"><kbd>?</kbd> <span>Show Shortcuts</span></div>
  </div>
</div>
```

3. Add `#epSearchInput` inside `#epPanel`:
```html
<div class="ep-search-wrap">
  <input type="search" id="epSearchInput" placeholder="Filter episodes (e.g. 12, canon)..." autocomplete="off" />
  <button type="button" class="ep-search-clear" id="epSearchClear" title="Clear filter" aria-label="Clear filter">✕</button>
</div>
```

4. In client JS:
- Implement `showOsd(icon, text)`:
```javascript
var osdTimer = null;
var actionOsd = document.getElementById('actionOsd');
var osdIcon = document.getElementById('osdIcon');
var osdText = document.getElementById('osdText');

function showOsd(icon, text) {
  if (!actionOsd || !osdIcon || !osdText) return;
  osdIcon.textContent = icon;
  osdText.textContent = text;
  actionOsd.classList.add('is-active');
  clearTimeout(osdTimer);
  osdTimer = setTimeout(function () {
    actionOsd.classList.remove('is-active');
  }, 1200);
}
```
- Wire `showOsd` to volume adjustments, mute toggles, playback rate changes, and skip triggers.
- Wire `?` keydown and `#shortcutsClose` to toggle `#shortcutsModal`.
- Wire `epSearchInput` to filter cards in `#epList`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/watchOsdShortcuts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/watch.ts tests/handlers/watchOsdShortcuts.test.ts
git commit -m "feat(watch): add Action OSD HUD, Keyboard Shortcuts cheatsheet dialog, and episode drawer search"
```

---

### Task 4: Browse Catalog Debounced Live Search, Instant Clear Button, & Rich Empty State

**Files:**
- Modify: `src/handlers/pages/browse.ts`
- Create: `tests/handlers/browseSearch.test.ts`

**Interfaces:**
- Consumes: `#q`, `#qMobile`, `searchBtn`, `submitSearch()`, catalog categories.
- Produces: Debounced search, clear button `.search-clear-btn`, rich empty state `.empty-search`.

- [ ] **Step 1: Write the failing test for live debounced search and clear button**

Create `tests/handlers/browseSearch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

describe('Browse Debounced Live Search & Clear Button', () => {
  it('renders search clear buttons in desktop and mobile search containers', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('id="qClear"');
    expect(html).toContain('class="search-clear-btn');
  });

  it('contains debounced input handler in client script', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('searchDebounceTimer');
    expect(html).toContain('300');
  });

  it('renders rich empty state with recovery recommendation pills', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('empty-search');
    expect(html).toContain('Clear search');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/browseSearch.test.ts`
Expected: FAIL with `expected html to contain 'id="qClear"'`

- [ ] **Step 3: Implement minimal code in `src/handlers/pages/browse.ts`**

1. In HTML template for desktop and mobile search:
```html
<div class="search-row">
  <div class="search-field-wrap">
    <input id="q" type="search" placeholder="One Piece, Citrus, Jujutsu Kaisen…" autocomplete="off" />
    <button type="button" class="search-clear-btn" id="qClear" aria-label="Clear search">✕</button>
  </div>
  <button type="button" class="btn" id="searchBtn">Search</button>
</div>
```

2. In client JS:
```javascript
var searchDebounceTimer = null;
var qClear = document.getElementById('qClear');

function updateClearBtnVisibility() {
  if (qClear) qClear.classList.toggle('is-visible', q.value.trim().length > 0);
  if (qMobileClear && qMobile) qMobileClear.classList.toggle('is-visible', qMobile.value.trim().length > 0);
}

if (q) {
  q.addEventListener('input', function () {
    updateClearBtnVisibility();
    clearTimeout(searchDebounceTimer);
    var val = q.value.trim();
    if (val.length >= 2) {
      searchDebounceTimer = setTimeout(function () {
        submitSearch();
      }, 300);
    }
  });
}

if (qClear) {
  qClear.addEventListener('click', function () {
    q.value = '';
    updateClearBtnVisibility();
    q.focus();
    selectCat('discover');
  });
}
```

3. Update empty state in search view:
```javascript
if (!results.length) {
  main.innerHTML =
    '<div class="empty empty-search">' +
      '<h2>No anime found for "' + esc(keyword) + '"</h2>' +
      '<p>Check for typos or try searching with alternative Japanese titles.</p>' +
      '<div class="empty-actions">' +
        '<button type="button" class="btn ghost" id="emptyClearBtn">Clear search</button>' +
        '<button type="button" class="pill" data-cat="discover">🔥 Discover</button>' +
        '<button type="button" class="pill" data-cat="most-popular">⭐ Popular</button>' +
        '<button type="button" class="pill" data-cat="top-airing">📺 Top Airing</button>' +
      '</div>' +
    '</div>';
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/browseSearch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/browse.ts tests/handlers/browseSearch.test.ts
git commit -m "feat(browse): add debounced live search, input clear button, and rich empty search state"
```

---

### Task 5: Browse Episode Range Chunking & Jump Navigation

**Files:**
- Modify: `src/handlers/pages/browse.ts:2690-2780`
- Create: `tests/handlers/browseEpisodeChunking.test.ts`

**Interfaces:**
- Consumes: `payload.episodes`, `#epGrid`.
- Produces: `.ep-chunk-bar`, `.ep-chunk-pill`, `.ep-jump-input`, rendering at most 50 cards per partition.

- [ ] **Step 1: Write the failing test for episode chunking and jump navigation**

Create `tests/handlers/browseEpisodeChunking.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

describe('Browse Episode Range Chunking & Jump Navigation', () => {
  it('contains episode chunking logic for anime with > 50 episodes', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('ep-chunk-bar');
    expect(html).toContain('ep-jump-input');
    expect(html).toContain('CHUNK_SIZE = 50');
  });

  it('renders jump input allowing fast navigation to any episode number', async () => {
    const app = new Hono();
    app.get('/browse', browseController);
    const res = await app.request('/browse');
    const html = await res.text();
    expect(html).toContain('Jump to ep #');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/browseEpisodeChunking.test.ts`
Expected: FAIL with `expected html to contain 'ep-chunk-bar'`

- [ ] **Step 3: Implement minimal code in `src/handlers/pages/browse.ts`**

In `renderEpisodes(anime, payload, detail)` in `src/handlers/pages/browse.ts`:
```javascript
var CHUNK_SIZE = 50;
var activeChunk = 0;

function renderChunkBar() {
  if (episodes.length <= CHUNK_SIZE) return '';
  var totalChunks = Math.ceil(episodes.length / CHUNK_SIZE);
  var pills = '';
  for (var c = 0; c < totalChunks; c++) {
    var start = c * CHUNK_SIZE + 1;
    var end = Math.min(episodes.length, (c + 1) * CHUNK_SIZE);
    var isSel = c === activeChunk;
    pills += '<button type="button" class="pill ep-chunk-pill' + (isSel ? ' is-active' : '') + '" data-chunk="' + c + '">' + start + '–' + end + '</button>';
  }
  return (
    '<div class="ep-chunk-bar">' +
      '<div class="ep-chunk-scroll">' + pills + '</div>' +
      '<div class="ep-jump-wrap">' +
        '<input type="number" class="ep-jump-input" id="epJumpInput" placeholder="Jump to ep #" min="1" max="' + episodes.length + '" />' +
      '</div>' +
    '</div>'
  );
}

function mountCurrentChunk() {
  var grid = document.getElementById('epGrid');
  if (!grid) return;
  grid.innerHTML = '';
  var startIdx = activeChunk * CHUNK_SIZE;
  var endIdx = Math.min(episodes.length, startIdx + CHUNK_SIZE);
  var currentSlice = episodes.slice(startIdx, endIdx);
  var frag = document.createDocumentFragment();
  currentSlice.forEach(function (ep) {
    // Render individual episode card
    frag.appendChild(createEpCard(ep));
  });
  grid.appendChild(frag);
}
```

Wire `epJumpInput` event to switch `activeChunk` and scroll the matching card into view.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/browseEpisodeChunking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/browse.ts tests/handlers/browseEpisodeChunking.test.ts
git commit -m "feat(browse): implement 50-episode chunking and instant jump input for long series"
```

---

### Task 6: Cinematic Landing Page Hero Search & Continue Watching Resume Card

**Files:**
- Modify: `src/handlers/pages/landing.ts`
- Create: `tests/handlers/landingModern.test.ts`

**Interfaces:**
- Consumes: `localStorage['ani.cw']`, `/browse?q=...`.
- Produces: Direct hero search form `<form class="hero-search">` and Continue Watching card `#resumeCard`.

- [ ] **Step 1: Write the failing test for landing direct search and resume card**

Create `tests/handlers/landingModern.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { landingController } from '../../src/handlers/pages/landing';

describe('Landing Page Hero Search & Continue Watching', () => {
  it('renders direct search form routing to /browse', async () => {
    const app = new Hono();
    app.get('/', landingController);
    const res = await app.request('/');
    const html = await res.text();
    expect(html).toContain('<form class="hero-search" action="/browse" method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Search anime');
  });

  it('contains continue watching client script reading ani.cw from localStorage', async () => {
    const app = new Hono();
    app.get('/', landingController);
    const res = await app.request('/');
    const html = await res.text();
    expect(html).toContain("localStorage.getItem('ani.cw')");
    expect(html).toContain('id="resumeSection"');
    expect(html).toContain('Resume');
  });

  it('enforces 16px font-size on search input for mobile devices', async () => {
    const app = new Hono();
    app.get('/', landingController);
    const res = await app.request('/');
    const html = await res.text();
    expect(html).toContain('font-size: 16px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/landingModern.test.ts`
Expected: FAIL with `expected html to contain '<form class="hero-search"'`

- [ ] **Step 3: Implement minimal code in `src/handlers/pages/landing.ts`**

1. In `src/handlers/pages/landing.ts`, add the hero search form:
```html
<form class="hero-search" action="/browse" method="get">
  <div class="hero-search-box">
    <input type="search" name="q" placeholder="Search anime by title, e.g. Frieren, Solo Leveling, Bleach…" autocomplete="off" required />
    <button type="submit" class="btn" aria-label="Search">Search</button>
  </div>
</form>
```

2. Add the dynamic resume container placeholder:
```html
<div class="resume-section" id="resumeSection" style="display: none;"></div>
```

3. Add client script in `landing.ts`:
```html
<script>
  (function () {
    try {
      var raw = localStorage.getItem('ani.cw');
      if (!raw) return;
      var list = JSON.parse(raw);
      if (!list || !list.length) return;
      var item = list[0];
      var sec = document.getElementById('resumeSection');
      if (!sec) return;
      var pct = item.dur > 0 ? Math.min(100, Math.round((item.time / item.dur) * 100)) : 0;
      var watchUrl = '/watch?animeId=' + encodeURIComponent(item.id) + (item.epId ? '&episodeId=' + encodeURIComponent(item.epId) : '');
      var poster = item.poster ? '<img src="' + item.poster + '" alt="" class="resume-thumb" />' : '';
      sec.innerHTML =
        '<div class="resume-card">' +
          poster +
          '<div class="resume-info">' +
            '<span class="resume-label">Continue Watching</span>' +
            '<h3 class="resume-title">' + (item.title || item.id) + '</h3>' +
            '<p class="resume-sub">Episode ' + (item.epNum || 1) + (pct > 0 ? ' · ' + pct + '% complete' : '') + '</p>' +
            '<div class="resume-bar"><div class="resume-prog" style="width:' + pct + '%;"></div></div>' +
          '</div>' +
          '<a class="btn resume-btn" href="' + watchUrl + '">▶ Resume</a>' +
        '</div>';
      sec.style.display = 'block';
    } catch (e) {}
  })();
</script>
```

4. Add matching CSS rules with `font-size: 16px` on input.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/handlers/landingModern.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/pages/landing.ts tests/handlers/landingModern.test.ts
git commit -m "feat(landing): modernize hero with direct search form and Continue Watching resume card"
```

---

### Task 7: Comprehensive Suite Verification, Rebuilding Bundle, and Integration Testing

**Files:**
- Modify: `api/index.js` (compiled via `build-vercel.mjs`)
- Test: Vitest and Playwright test suites

**Interfaces:**
- Consumes: All updated pages.
- Produces: Up-to-date `api/index.js` production bundle and 100% green tests.

- [ ] **Step 1: Run type checking**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run all unit and integration tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Run Playwright mobile test suite**

Run: `npm run test:mobile`
Expected: All mobile tests across Pixel 7, iPhone 14, and Landscape viewports pass.

- [ ] **Step 4: Recompile Vercel API bundle**

Run: `node build-vercel.mjs`
Expected: Bundled `api/index.js` generated successfully with exit code 0.

- [ ] **Step 5: Commit build output and verifications**

```bash
git add api/index.js
git commit -m "build: recompile Vercel production bundle after comprehensive UI/UX revision"
```

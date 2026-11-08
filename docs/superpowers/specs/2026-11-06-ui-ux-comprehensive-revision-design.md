# Comprehensive UI/UX Revision & Mobile Touch Lifecycle Specification

- **Date**: 2026-11-06
- **Branch**: `feat/comprehensive-ui-ux-revision`
- **Target App**: `ani.watch` (`aniwatch-api`)
- **Status**: Validated Design

---

## 1. Problem Statement & Motivation

Following the initial mobile UX foundation, a comprehensive review identified key friction points and regressions across the user journey on both mobile and desktop:

1. **Mobile Video Player Tap Bug (~0.5s Disappearance)**:
   - Tapping the video screen on mobile only displays the controls HUD for ~300–500ms before it unexpectedly vanishes.
   - **Root Cause**: In `src/handlers/pages/watch.ts`, line 3291 attaches `stage.addEventListener('touchstart', pokeControls)`. When the user taps the screen, `touchstart` fires at $t = 0$, immediately calling `pokeControls` which adds `.show-controls`. When the touch ends (~50ms later), `pointerup` fires and schedules a single-tap evaluation timeout (`tapTimer = setTimeout(..., 280)`). At $t \approx 330$ms, the timer callback checks:
     ```js
     if (stage.classList.contains('show-controls') && !video.paused) {
       stage.classList.remove('show-controls');
       stage.classList.add('cursor-hidden');
     }
     ```
     Because `touchstart` had preemptively forced `.show-controls`, the single-tap callback interprets the controls as already visible and hides them immediately!
   - **Expected Behavior**: Single tap when controls are hidden reveals the controls for 4 seconds of inactivity. Single tap when controls are already visible dismisses them immediately.

2. **Player Seek & Scrub Blindness**:
   - The `.seek` slider lacks an interactive scrub tooltip showing the targeted timestamp before releasing the thumb.
   - The seekbar only renders `--progress` (current playback head), failing to display `--buffered` segments loaded ahead in memory.

3. **Missing Visual Feedback for Hotkeys & Actions**:
   - Volume adjustment, muting, playback rate changes, and 10-second skip hotkeys update playback without an On-Screen Display (OSD) feedback banner.

4. **Episode Management & Keyboard Discovery**:
   - The watch page episode drawer lacks a search/jump filter, forcing manual scrolling through long episode lists.
   - Keyboard power users have no in-player discovery for shortcuts (`?` / `Shift+/`).

5. **Browse Catalog Friction & DOM Overload**:
   - The search inputs (`#q`, `#qMobile`) require an explicit Enter keypress or button click; there is no live debouncing or quick `✕` clear button.
   - Zero-result searches show a dead-end message with no quick recovery paths.
   - For long-running anime (e.g. *One Piece* with 1,100+ episodes, *Detective Conan*), rendering all episode cards at once generates 1,000+ DOM cards, degrading mobile performance.

6. **Static Landing Page**:
   - The homepage (`/`) is currently a static text billboard. Users cannot search directly from the homepage and have no quick way to resume their currently watching series.

---

## 2. Architecture & Detailed Specifications

### 2.1 Video Player Touch Lifecycle & HUD Enhancements (`src/handlers/pages/watch.ts`)

#### Mobile Tap Lifecycle State Machine
- **Remove Preemptive Touchstart Poke**:
  - Delete `stage.addEventListener('touchstart', pokeControls)` at line 3291.
- **Touch Tracking in Stage Gestures**:
  - On `pointerdown` / `touchstart` on `#stage`:
    - Check if touch target is a control button, drawer, menu, or slider. If so, let event propagate naturally.
    - If target is the video stage background or video surface: record `wasVisibleAtTouchStart = stage.classList.contains('show-controls')`.
  - On `pointerup` / `touchend` (single-tap resolution after 280ms debounce window):
    - **If `!wasVisibleAtTouchStart`**:
      - Add `.show-controls` to `#stage`.
      - Remove `.cursor-hidden` from `#stage`.
      - Start standard 4.0s auto-hide timer (`startHideTimer()`).
    - **If `wasVisibleAtTouchStart`**:
      - If video is playing, dismiss controls immediately: remove `.show-controls`, add `.cursor-hidden`, and clear any pending `hideTimer`.
      - If video is paused, keep controls visible.
  - On double tap (two taps within 280ms):
    - Cancel single-tap timer.
    - If left 35%: seek -10s and trigger OSD.
    - If right 35%: seek +10s and trigger OSD.
    - If center 30%: toggle play/pause.

#### Interactive Scrub Tooltip (`.seek-tooltip`)
- Create a floating tooltip element `.seek-tooltip` positioned inside `.seek-wrap` above the track.
- On `pointermove` (desktop hover) or `touchmove` (mobile touch scrub) over `.seek-wrap`:
  - Calculate target fraction: `frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))`.
  - Format target time: `formatTime(frac * video.duration)`.
  - Position tooltip horizontally: `tooltip.style.left = (frac * 100) + '%'`.
  - Make visible (`opacity: 1`).
- On `pointerleave` / `touchend`:
  - Hide tooltip (`opacity: 0`).

#### Buffered Range Visualization (`--buffered`)
- On `progress` and `timeupdate` events on `video`:
  - Find the time range in `video.buffered` that encompasses `video.currentTime` (or the highest buffered point if buffering ahead):
    ```js
    var dur = video.duration || 1;
    var bufEnd = 0;
    for (var i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
        bufEnd = video.buffered.end(i);
        break;
      }
      if (video.buffered.end(i) > bufEnd) bufEnd = video.buffered.end(i);
    }
    var bufPct = Math.min(100, Math.max(0, (bufEnd / dur) * 100));
    seek.style.setProperty('--buffered', bufPct + '%');
    ```
- Seek track CSS updated to render 3 visual layers:
  - Base track background: `rgba(255, 255, 255, 0.15)`.
  - Buffered progress (`--buffered`): `rgba(255, 255, 255, 0.35)` or `rgba(61, 214, 198, 0.25)`.
  - Played progress (`--progress`): `var(--accent)` (red / cyan theme accent).

#### Action & Volume OSD HUD (`.action-osd`)
- Add a centered transient HUD pill at top-center of `#stage`:
  ```html
  <div class="action-osd" id="actionOsd" aria-live="polite" aria-atomic="true">
    <span class="osd-icon" id="osdIcon"></span>
    <span class="osd-text" id="osdText"></span>
  </div>
  ```
- Function `showOsd(icon, text)`:
  - Updates `#osdIcon` and `#osdText`.
  - Adds `.is-active` to `#actionOsd` (CSS fade-in and scale-up).
  - Clears previous timer and sets a 1.2s timeout to remove `.is-active`.
- Triggers on:
  - Volume up/down hotkeys: `🔊 80%`, `🔇 Muted`.
  - Speed hotkeys (`>` / `<`): `⚡ 1.25×`, `⚡ 1.5×`.
  - 10s skip hotkeys / double taps: `⏪ -10s`, `⏩ +10s`.

#### Keyboard Shortcuts Cheatsheet Modal
- Accessible dialog (`role="dialog"`, `aria-modal="true"`) toggled via `?` or `Shift+/`, or from settings menu.
- Lists keyboard hotkeys in a 2-column table:
  - `Space` / `K`: Play / Pause
  - `J` / `L`: Seek -10s / +10s
  - `←` / `→`: Seek -5s / +5s
  - `↑` / `↓`: Volume Up / Down
  - `M`: Mute / Unmute
  - `F`: Toggle Fullscreen
  - `C`: Toggle Captions
  - `[` / `]`: Previous / Next Episode
  - `?`: Toggle Keyboard Shortcuts

#### Episode Drawer Search & Filter
- Add a sticky search box at top of `#epPanel`:
  ```html
  <div class="ep-search-wrap">
    <input id="epSearchInput" type="search" placeholder="Filter episodes (e.g. 12, canon)..." />
    <button type="button" class="ep-search-clear" id="epSearchClear" title="Clear">✕</button>
  </div>
  ```
- Instant client-side filtering matching episode number or title text.

---

### 2.2 Browse Catalog & Instant Search Enhancements (`src/handlers/pages/browse.ts`)

#### Debounced Live Search (300ms) with Clear Button
- Attach `input` event listener to `#q` (desktop) and `#qMobile` (mobile):
  - 300ms debounce timer.
  - If query length >= 2, triggers search automatically.
  - Pressing `Enter` executes immediately and cancels debounce.
- Add clear button `.search-clear-btn` inside the search row:
  - Visible whenever `input.value.length > 0`.
  - Clicking clears the input, focuses it, and restores default category tab.

#### Rich Search Empty State
- When `results.length === 0`, render:
  - Title: `"No anime found for \"<query>\""`.
  - Guidance text: *"Check for typos or try searching by Japanese or alternative titles."*
  - Action pills:
    - `[✕ Clear Search]`
    - `[🔥 Discover]`
    - `[⭐ Most Popular]`
    - `[📺 Top Airing]`

#### Episode Range Chunking (for 50+ Episode Series)
- When `episodes.length > 50`:
  - Calculate 50-episode chunk partitions: `[1–50]`, `[51–100]`, `[101–150]`, etc.
  - Render a horizontal scrollable chunk selector above `#epGrid`.
  - Add quick jump input: `<input class="ep-jump-input" type="number" placeholder="Go to #…" min="1" max="TOTAL" />`.
  - Entering an episode number switches to that chunk and highlights/scrolls to the card.
  - Mount only the active 50 episode cards in DOM, drastically cutting DOM nodes and memory on mobile.

---

### 2.3 Cinematic Landing Page Hero & Resume Card (`src/handlers/pages/landing.ts`)

#### Direct Hero Search Form
- Add high-contrast search form in the landing hero:
  ```html
  <form class="hero-search" action="/browse" method="GET">
    <div class="hero-search-box">
      <input type="search" name="q" placeholder="Search anime by title, e.g. Frieren, Solo Leveling, Bleach…" autocomplete="off" required />
      <button type="submit" class="btn" aria-label="Search">Search</button>
    </div>
  </form>
  ```
- Submitting navigates to `/browse?q=<query>`, initiating the search on page load.

#### Continue Watching Resume Banner (from `localStorage['ani.cw']`)
- Client script reads `ani.cw` on load.
- If entries exist, dynamically mount a Resume Banner:
  - Thumbnail poster image with aspect ratio `16:9` / `3:4`.
  - Title and episode badge: e.g. `Solo Leveling · Episode 8`.
  - Progress bar: `(time / dur) * 100%`.
  - Primary CTA button: `▶ Resume Ep 8` linking to `/watch?animeId=...&episodeId=...`.
- If `ani.cw` is empty or invalid, the banner remains hidden.

#### Visual Polish & Mobile Compliance
- Dark cinema ambient radial gradients.
- Category quick pills below search: `Popular`, `Top Airing`, `Discover`.
- Input fields enforce `font-size: 16px` to prevent iOS viewport auto-zoom.

---

## 3. Data Flow & State Management

```
[ Landing Page: / ]
   ├── Input search query ──────> GET /browse?q=<query>
   └── Read localStorage['ani.cw'] ──> Mount Resume Card ──> GET /watch?animeId=...&episodeId=...

[ Browse Page: /browse ]
   ├── Debounced input (#q) ───(300ms)──> navigate({ view: 'search', keyword })
   ├── Select Episode Chunk ───────> Slice episodes array (50 eps) ──> Render into #epGrid
   └── Click Anime Card ──────────> GET /watch?animeId=...

[ Watch Page: /watch ]
   ├── Stage Single Tap ───────> Toggle .show-controls / startHideTimer()
   ├── Seekbar Scrub ──────────> Update .seek-tooltip with projected timestamp
   ├── Video Progress ─────────> Update --buffered on .seek element
   ├── Hotkey / Seek Action ───> showOsd(icon, text)
   └── Video timeupdate ───────> Write progress to localStorage['ani.cw']
```

---

## 4. Error Handling & Edge Cases

| Area | Edge Case | Mitigation |
|---|---|---|
| **Mobile Tap** | User double-taps rapidly | Single-tap timer (280ms) is cancelled, double-tap seek is executed without dismissing controls. |
| **Mobile Tap** | User taps slider, button, or menu | Event propagation stopped or `e.target.closest('.controls, .menu, .ep-panel')` ignored by stage tap handler. |
| **Seek Buffer** | `video.buffered` is empty or duration is `NaN` | Default `--buffered: 0%` gracefully without throwing errors. |
| **Live Search** | User clears input while debounce pending | Clear button cancels debounce and immediately switches view back to active category tab. |
| **Episode Chunk** | User inputs non-existent episode number (`9999`) | Jump input clamps to `[1, totalEpisodes]` and displays brief warning toast if invalid. |
| **Landing Resume**| `localStorage['ani.cw']` is corrupted or empty | Wrapped in `try...catch`; gracefully ignores errors and leaves Resume Banner unmounted. |

---

## 5. Verification & Testing Strategy

1. **Unit & Integration Tests**:
   - `test/plan.test.js`, `test/curate.test.js`.
   - Test debounced search and URL parameter parsing.
2. **Playwright Mobile E2E Tests** (`tests/mobile/`):
   - **Mobile Tap Lifecycle**: Tap on stage reveals controls for >= 3 seconds. Second tap dismisses controls.
   - **Double Tap**: Double tap triggers skip without hiding controls.
   - **Scrub Tooltip & Buffer**: Scrub interaction updates tooltip time and `--buffered` CSS variable exists.
   - **Episode Chunker**: Series with > 50 episodes correctly displays chunk navigation and renders 50 items.
3. **Playwright Desktop & Landing Tests**:
   - Hero search form routes to `/browse?q=...`.
   - Continue Watching resume card renders properly when `ani.cw` is populated.
4. **Build & Type Check**:
   - `npm run type-check` (TypeScript clean).
   - `node build-vercel.mjs` (Vercel API bundle recompiled and verified).

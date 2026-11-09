# Player Experience & Binge-Watching Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Ani-Watch's player into a premier binge-watching and ergonomics platform with opt-in Auto-Skip Intro/Outro, Smart Outro Auto-Next, Web Audio API Stable Volume Normalization, Subtitle Sync offsets, Mobile Double-Tap Ripple Seeking, Press-and-Hold 2.0x speed, Episode Watched Progress Bars, and YouTube/Vim hotkeys.

**Architecture:** Decompose client capabilities into modular, self-contained functional controllers within the SSR watch controller (`watch.ts`) and browse page (`browse.ts`). Maintain zero runtime dependencies and zero additional HTTP asset requests on serverless cold starts.

**Tech Stack:** TypeScript, Hono, Web Audio API (`AudioContext`, `DynamicsCompressorNode`), Web Storage API (`localStorage`), Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-09-player-experience-suite-design.md`](file:///c:/Users/orkar/Documents/GitHub/ani-watch/docs/superpowers/specs/2026-11-09-player-experience-suite-design.md)

## Global Constraints
- Client templates in `watch.ts` and `browse.ts` must remain 100% dependency-free at client runtime.
- All interactive touch elements must provide $\ge 44\times 44$px touch targets on mobile viewports.
- Web Audio API initialization must be lazy and non-blocking, gracefully handling browser autoplay and iframe restrictions without unhandled errors.
- All user preferences must persist in `localStorage` under the `ani.*` key namespace.
- Recompile the Vercel production bundle via `node build-vercel.mjs` before PR creation.

---

### Task 1: Automation Suite (Auto-Skip & Smart Auto-Next)

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Test: `tests/handlers/watchAutomation.test.ts`

**Interfaces:**
- Consumes: `skips[track]` (`intro`, `outro`), `nextPlaySafe`, `video.currentTime`, `video.duration`
- Produces: `localStorage.getItem('ani.autoSkip')`, `localStorage.getItem('ani.autoNext')`, `#autoSkipToggle`, `#autoNextToggle`, `#outroBadge` with 5s countdown, reduced 5s ended timer.

- [x] **Step 1: Write failing test in `tests/handlers/watchAutomation.test.ts`**
  Assert watch HTML contains `#autoSkipToggle` and `#autoNextToggle` switches. Assert client script contains auto-skip seek logic on `timeupdate`, smart `#outroBadge` countdown, and 5-second countdown on `ended`.
- [x] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/watchAutomation.test.ts`
- [x] **Step 3: Implement automation markup and script in `src/handlers/pages/watch.ts`**
  - Add "Playback" section in `#settingsMenu` with `#autoSkipToggle` and `#autoNextToggle`.
  - In `timeupdate`, check `ani.autoSkip` and auto-seek past `intro` and `outro` ranges with `showOsd('⚡', 'Auto-skipped Intro')`.
  - When entering `outro.start`, render `#outroBadge` floating above controls with 5s countdown and "Play Now" / "✕" dismiss buttons.
  - In `ended` listener, reduce legacy 12s timer to 5s and respect `ani.autoNext`.
- [x] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/watchAutomation.test.ts`
- [x] **Step 5: Commit changes**
  Commit: `git commit -am "feat(watch): implement auto-skip intro/outro and smart auto-next countdown"`

---

### Task 2: Audio Normalization ("Stable Volume" via Web Audio API)

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Test: `tests/handlers/watchAudioNormalizer.test.ts`

**Interfaces:**
- Consumes: `<video id="v">`, `window.AudioContext`
- Produces: `initAudioNormalizer()`, `DynamicsCompressorNode` chain, `ani.stableVolume`, `#stableVolumeToggle` switch.

- [ ] **Step 1: Write failing test in `tests/handlers/watchAudioNormalizer.test.ts`**
  Assert `#settingsMenu` contains `#stableVolumeToggle`. Assert client script defines `initAudioNormalizer()` connecting `MediaElementSource` to `DynamicsCompressorNode`, with safe bypass when disabled.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/watchAudioNormalizer.test.ts`
- [ ] **Step 3: Implement Web Audio compressor and toggle in `src/handlers/pages/watch.ts`**
  - Add `#stableVolumeToggle` in `#settingsMenu` under Audio section.
  - Implement `initAudioNormalizer()` with lazy user-gesture trigger, `-24dB` threshold, `12:1` ratio compressor.
  - Persist setting in `localStorage.setItem('ani.stableVolume', enabled ? '1' : '0')`.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/watchAudioNormalizer.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(watch): implement stable volume audio normalization with Web Audio API"`

---

### Task 3: Subtitle Timing Synchronization & Global Audio Preference

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Test: `tests/handlers/watchSubtitleSync.test.ts`

**Interfaces:**
- Consumes: `captions[track]`, `renderCcAt(t)`
- Produces: `ani.subOffset` (`-2.0s` to `+2.0s`), `#ccOffset` range slider, `#ccOffsetReset`, `Z`/`X` keyboard shortcuts, global `ani.audioPref` persistence.

- [ ] **Step 1: Write failing test in `tests/handlers/watchSubtitleSync.test.ts`**
  Assert `#settingsMenu` subtitle section contains `#ccOffset` range input and `#ccOffsetReset` button. Assert client script incorporates `subOffset` into `renderCcAt(t + subOffset)` and binds `Z` (-100ms) and `X` (+100ms) shortcuts. Assert audio track toggles persist `ani.audioPref`.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/watchSubtitleSync.test.ts`
- [ ] **Step 3: Implement subtitle sync offset and global audio preference in `src/handlers/pages/watch.ts`**
  - Add subtitle offset slider and reset button in `#ccControls`.
  - In `renderCcAt(t)`, query cues with `effectiveTime = Math.max(0, t + subOffset)`.
  - Add `Z` / `X` keyboard handlers in `handleKeydown` displaying Action OSD HUD (`Sub Sync: +0.2s`).
  - Store audio preference on track changes: `localStorage.setItem('ani.audioPref', track)`.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/watchSubtitleSync.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(watch): implement subtitle sync offset slider, Z/X shortcuts, and global audio preference"`

---

### Task 4: Mobile Touch Gestures & Press-and-Hold 2.0x Boost

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Test: `tests/handlers/watchTouchGestures.test.ts`, `tests/mobile/player-gestures.spec.ts`

**Interfaces:**
- Consumes: Mobile touch events (`touchstart`, `touchend`, `touchcancel`), screen width partitions.
- Produces: Double-tap seek $\pm 10$s with compounding counter, `#seekRippleOverlay` animated ripples, center double-tap fullscreen, press-and-hold 2.0x speed boost with `#holdSpeedPill`.

- [ ] **Step 1: Write failing unit test in `tests/handlers/watchTouchGestures.test.ts`**
  Assert client script has gesture classifier distinguishing left/center/right taps, ripple overlay markup `#seekRippleOverlay`, and hold timer setting `playbackRate = 2.0` with `#holdSpeedPill`.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/watchTouchGestures.test.ts`
- [ ] **Step 3: Implement touch gestures in `src/handlers/pages/watch.ts`**
  - Add `#seekRippleOverlay` and `#holdSpeedPill` HTML and CSS styling.
  - Implement touch gesture recognizer in client script tracking taps, coordinates, and hold durations ($> 400$ms).
  - Add double-tap ripple animation for left third (seek -10s) and right third (seek +10s).
  - Add double-tap center for fullscreen toggle.
  - Add press-and-hold 2.0x rate boost, restoring previous speed on release.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/watchTouchGestures.test.ts`
- [ ] **Step 5: Run Playwright mobile test spec**
  Run: `npm run test:mobile`
- [ ] **Step 6: Commit changes**
  Commit: `git commit -am "feat(watch): implement mobile double-tap ripple seek and press-and-hold 2x speed"`

---

### Task 5: Navigation Continuity, Watched Progress Bars & YouTube Shortcuts

**Files:**
- Modify: `src/handlers/pages/watch.ts`, `src/handlers/pages/browse.ts`
- Test: `tests/handlers/watchProgressShortcuts.test.ts`

**Interfaces:**
- Consumes: `video.currentTime`, `video.duration`, `animeId`, `epNum`
- Produces: `ani.progress.<animeId>.<epNum>` in `localStorage`, `.ep-progress-bar` in episode list and browse cards, YouTube shortcuts (`J`, `K`, `L`, `M`, `C`, `N`, `P`).

- [ ] **Step 1: Write failing test in `tests/handlers/watchProgressShortcuts.test.ts`**
  Assert `timeupdate` writes `ani.progress.<animeId>.<epNum>` with time, duration, and ratio. Assert episode cards render `.ep-progress-bar` accent lines. Assert `J`, `K`, `L`, `M`, `C`, `N`, `P` are bound in client script and documented in `#shortcutsModal`.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/watchProgressShortcuts.test.ts`
- [ ] **Step 3: Implement progress tracking and YouTube shortcuts**
  - Record progress percentage during playback in `localStorage`.
  - In `#epPanel` drawer and `browse.ts` episode grid, inject `.ep-progress-bar` reflecting saved ratio.
  - Add `J`, `K`, `L`, `M`, `C`, `N`, `P` keys to `watch.ts` keydown handler and shortcuts modal.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/watchProgressShortcuts.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(watch): add watched progress bars and YouTube/Vim keyboard shortcuts"`

---

### Task 6: Production Build, Full Verification & Pull Request

**Files:**
- Modify: `api/index.js` (recompiled bundle)

- [ ] **Step 1: Run linter and clean up any unused variables**
  Run: `npm run lint`
- [ ] **Step 2: Run full unit & security test suite**
  Run: `npm test`
- [ ] **Step 3: Run TypeScript compiler check**
  Run: `npm run type-check`
- [ ] **Step 4: Run Playwright mobile test suite**
  Run: `npm run test:mobile`
- [ ] **Step 5: Recompile Vercel production bundle**
  Run: `node build-vercel.mjs`
- [ ] **Step 6: Commit recompiled bundle**
  Commit: `git commit -am "build: recompile Vercel production bundle for player experience suite"`
- [ ] **Step 7: Push branch to remote and create Pull Request**
  Run: `git push -u origin feat/player-experience-suite`
  Run: `gh pr create --base main --head feat/player-experience-suite --title "feat: player experience suite (auto-skip, stable volume, touch ripples, progress bars)" --body "..."`

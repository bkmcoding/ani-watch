# Mobile UX Revision & Automated Test Suite Design Specification

- **Date**: 2026-11-04
- **Branch**: `feat/mobile-ux-revision`
- **Target App**: `ani.watch` (`aniwatch-api`)
- **Status**: Validated Design

---

## 1. Problem Statement & Motivation

Mobile users currently face significant usability and accessibility hurdles across `ani.watch`:
1. **Fullscreen & Orientation**:
   - Tapping fullscreen does not auto-rotate the device into landscape.
   - On iOS Safari (iPhone), standard DOM fullscreen (`element.requestFullscreen()`) fails or is unsupported for arbitrary `<div>` containers.
   - The player does not listen to `fullscreenchange` events, resulting in stale UI state (the fullscreen icon does not reflect exit/enter states when users swipe or press back).
2. **Persistent Controls HUD**:
   - On mobile touch screens, tapping any control button (such as fullscreen `#fs`, play `#playBtn`, mute `#muteBtn`, or settings `#settingsBtn`) grants that button browser `:focus`. Because touch browsers never blur tapped buttons, `.stage:focus-within .controls` keeps the video player controls permanently visible at 100% opacity with active pointer events, obscuring subtitles and playback.
3. **Settings Dialog Not Fitting & Blur Bug**:
   - In landscape mobile orientation (`height <= 540px`, `width >= 800px`), media queries targeting `@media (max-width: 720px)` fail to match. The desktop popover styles apply, resulting in a clipped, unscrollable menu.
   - A recent regression placed a full-screen `.sheet-backdrop` with `backdrop-filter: blur(8px)` at `z-index: 998`, while the desktop `.menu` dialog had `z-index: 5`. As a result, opening settings blurred out the entire screen including the settings dialog itself, rendering text unreadable and blocking clicks.
4. **Lack of Automated Mobile Verification**:
   - Previous revisions lacked automated mobile viewport testing, allowing touch and orientation bugs to slip through unnoticed.

---

## 2. Architecture & Detailed Specifications

### 2.1 Video Player Fullscreen & Auto-Rotation (`src/handlers/pages/watch.ts`)

#### Dual-Mode Fullscreen Handler
- **Standard Modern Browsers (Android Chrome, Desktop, iPadOS)**:
  - Call `stage.requestFullscreen()` (with `webkitRequestFullscreen` fallback).
  - Call `screen.orientation.lock('landscape')` wrapped in `.catch(() => {})` for graceful degradation on platforms or security contexts where screen orientation locking is rejected.
- **iOS Safari (iPhone)**:
  - If `stage.requestFullscreen` is unavailable or rejected, detect iPhone coarse pointer and invoke `video.webkitEnterFullscreen()`. iOS native player handles landscape rotation and scrub gestures natively.
- **Exit Fullscreen**:
  - Call `document.exitFullscreen() || document.webkitExitFullscreen()`.
  - Call `screen.orientation.unlock()` if orientation was previously locked.
- **Event Listeners**:
  - Listen for `fullscreenchange` and `webkitfullscreenchange` on `document`.
  - Listen for `webkitendfullscreen` on `video` (for iOS Safari).
  - Handler updates `.is-fullscreen` on `#stage` and `document.body`.
  - Toggles the `#fs` button icon and `aria-label` / `title` between `"Fullscreen (F)"` and `"Exit Fullscreen (F)"`.
  - Calls `document.activeElement?.blur()` to instantly drop sticky focus.
  - Pokes controls (`pokeControls()`) so controls appear briefly and auto-fade cleanly.

### 2.2 Controls Auto-Hide & Touch State Fix

#### Focus Scoping
- In CSS, restrict `.stage:focus-within .controls` so it only activates under desktop keyboard navigation (`:focus-visible`) or mouse hover environments (`@media (hover: hover)`):
  ```css
  @media (hover: hover) {
    .stage:focus-within .controls {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  }
  .stage:has(:focus-visible) .controls {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  ```
- In JavaScript, inside control button click handlers (`#fs`, `#playBtn`, `#muteBtn`, `#settingsBtn`, `#epListBtn`), call `this.blur()` when `window.matchMedia('(pointer: coarse)').matches`.

#### Touch Stage Gestures
- **Single Tap on Stage**:
  - If controls are currently visible (`stage.classList.contains('show-controls')`) and video is playing: immediately hide controls (`clearTimeout(hideTimer)`, remove `show-controls`, add `cursor-hidden`).
  - If controls are hidden: show controls (`pokeControls()`) and start the 3.5s auto-hide timer.
- **Double Tap (Left / Right)**:
  - Left 38% of stage: seek -10s with ripple visual.
  - Right 38% of stage: seek +10s with ripple visual.
  - Center 24%: toggle play/pause.
  - Double taps do not leave controls stuck open.

---

### 2.3 Adaptive Settings & Episode Drawer System

#### Backdrop Layering & Blur Elimination
- **Desktop (`min-width: 721px` & height > 540px)**:
  - `.sheet-backdrop` is strictly suppressed: `display: none !important; pointer-events: none !important;`.
  - The desktop settings menu is a crisp, unblurred floating panel anchored directly above the settings button.
- **Mobile (`max-width: 720px` or `max-height: 540px`)**:
  - `.sheet-backdrop`: `z-index: 90;` with `background: rgba(0, 0, 0, 0.65); backdrop-filter: none !important; -webkit-backdrop-filter: none !important;`. This eliminates the bug where settings dialog text is blurred out and prevents mobile GPU compositing penalties.
  - `.menu` and `.ep-panel`: `z-index: 100;`, guaranteeing drawers always render in front of the scrim.

#### Responsive Drawer Layouts
- **Portrait Mobile (`max-width: 720px` & portrait orientation)**:
  - **Mode**: Native Bottom Sheet.
  - **Styles**: `position: fixed; left: 0; right: 0; bottom: 0; width: 100vw; max-height: min(85dvh, 560px); border-radius: 20px 20px 0 0;`.
  - **Header**: Drag handle pill (`.sheet-handle`), sticky header with 44×44px close button.
  - **Body**: Momentum touch scrolling (`-webkit-overflow-scrolling: touch; overscroll-behavior: contain;`), padding bottom includes `max(24px, env(safe-area-inset-bottom))`.
  - **Transition**: `transform: translateY(100%)` → `transform: translateY(0)`.
- **Landscape Mobile (`max-height: 540px` & landscape orientation)**:
  - **Mode**: Right Slide-Over Drawer.
  - **Styles**: `position: fixed; top: 0; bottom: 0; right: 0; left: auto; width: min(340px, 45vw); height: 100dvh; max-height: 100dvh; border-radius: 16px 0 0 16px; border-left: 1px solid var(--line); border-top: none;`.
  - **Header**: Compact header with close button.
  - **Body**: Full-height scrollable list, padded for camera notch/cutout (`env(safe-area-inset-right)`).
  - **Video Visibility**: Leaves the left 55%–70% of the screen fully visible with the video playing uninterrupted while settings or episodes are adjusted.
  - **Transition**: `transform: translateX(100%)` → `transform: translateX(0)`.
- **Episode Drawer (`#epPanel`) Parity**:
  - Implements identical adaptive bottom-sheet (portrait) and right-drawer (landscape) behavior, with episode items formatted with minimum 48px row heights for thumb accuracy.

---

### 2.4 Browse Page Mobile Ergonomics (`src/handlers/pages/browse.ts`)

1. **iOS Auto-Zoom Prevention**:
   - Enforce `font-size: 16px` on all inputs, search boxes, and select dropdowns on mobile viewports (`@media (max-width: 720px)`), eliminating unwanted iOS viewport zoom upon focus.
2. **Category Strip**:
   - Momentum scrollable container with hidden scrollbars and snapping.
   - Touch pills with minimum 40–44px height and tactile `:active` state.
3. **Touch Targets & Quick Actions**:
   - 44×44px tap targets on Watchlist toggle buttons and Continue Watching removal buttons.
   - Fluid 3-column grid down to 360px screen width, 2-column grid below 360px.
4. **Safe-Area Inset Hardening**:
   - All sticky headers, search floating action buttons, and drawers use `env(safe-area-inset-*)` guards.

---

### 2.5 Automated Mobile Testing Suite (`playwright.config.ts` & `tests/mobile/`)

#### Test Runner Configuration
- Playwright E2E configuration defining standard mobile device profiles:
  - **Pixel 7** (`isMobile: true`, `hasTouch: true`, viewport 412×915).
  - **iPhone 14** (`isMobile: true`, `hasTouch: true`, viewport 390×844).
  - **Mobile Landscape** (`isMobile: true`, `hasTouch: true`, viewport 844×390).
  - **Small Phone** (`isMobile: true`, `hasTouch: true`, viewport 360×640).

#### Test Suites
1. **`tests/mobile/player-controls.spec.ts`**:
   - Verifies controls appear on tap and cleanly auto-hide after timeout.
   - Verifies clicking `#fs` or `#playBtn` does not pin controls open via `:focus-within`.
   - Verifies fullscreen entering invokes orientation API or iOS native fullscreen fallback.
   - Verifies `fullscreenchange` updates button state and clears active element focus.
2. **`tests/mobile/player-drawers.spec.ts`**:
   - Verifies opening `#settingsBtn` in portrait displays bottom sheet (`bottom: 0`, height <= 85dvh).
   - Verifies opening `#settingsBtn` in landscape displays right-side drawer (`right: 0`, height <= 390px, width <= 340px) without overflow.
   - Verifies `.sheet-backdrop` sits strictly behind `.menu` (`z-index` validation) and settings text is readable without blur.
   - Verifies `#epPanel` behaves consistently in portrait and landscape.
3. **`tests/mobile/browse-mobile.spec.ts`**:
   - Verifies search input font size is `>= 16px` to prevent iOS auto-zoom.
   - Verifies search FAB is positioned above safe area.
   - Verifies quick-action touch target dimensions are `>= 44×44px`.
4. **NPM Integration**:
   - Script added to `package.json`: `"test:mobile": "playwright test tests/mobile"`.

---

## 3. Success Criteria & Verification Plan

1. **Orientation**: Clicking fullscreen on mobile automatically attempts orientation lock to landscape (or invokes iOS native fullscreen) and updates icon state.
2. **Controls Auto-Hide**: Controls on mobile player cleanly auto-hide after 3.5s or single tap, without lingering on screen.
3. **Settings Dialog**:
   - Desktop: Opens as a crisp floating popover; no screen blur scrim on top.
   - Mobile Portrait: Opens as a bottom sheet fitting <= 85dvh.
   - Mobile Landscape: Opens as a right-side drawer fitting within the 390px viewport height without clipping.
4. **Browse**: Search inputs do not zoom iOS viewport; touch targets meet WCAG 44×44px standards.
5. **Automated Tests**: All Playwright mobile tests and existing Vitest unit tests pass 100% cleanly.

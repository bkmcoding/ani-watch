---
target: src/handlers/pages/watch.ts
total_score: 14
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\orkar\\Documents\\GitHub\\ani-watch\\src\\handlers\\pages\\watch.ts"
target_path: "C:\\Users\\orkar\\Documents\\GitHub\\ani-watch\\src\\handlers\\pages\\watch.ts"
timestamp: 2026-10-25T21-30-00Z
slug: src-handlers-pages-watch-ts
---
# Impeccable Critique Report: src/handlers/pages/watch.ts (Mobile Video Experience)

Method: dual-agent (A: db43bd9e-f7d3-412a-9c38-20ba6f091431 · B: 8a8741e7-34ff-4fc1-9db8-154f7c21bc8a)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | 1 | Controls HUD takes 186px of a 199.7px stage (93.1%), completely obliterating the video frame |
| 2 | Match System / Real World | 2 | Desktop cramdown; tapping video pauses playback instead of toggling HUD; no ±10s double-tap seek |
| 3 | User Control and Freedom | 1 | Settings & episode drawers trapped in `overflow: hidden` `.stage` (<140px scrollable view) |
| 4 | Consistency and Standards | 2 | Violates iOS/Android mobile player ergonomics; 11-button bottom bar wraps into 3–5 rows |
| 5 | Error Prevention | 1 | Sub-44px touch targets (`#speedBtn` 36×38px, header 36px) adjacent to high-sensitivity seek bar |
| 6 | Recognition Rather Than Recall | 1 | Desktop keyboard shortcut cheat sheet (`<kbd>Space</kbd>`, `<kbd>[ ]</kbd>`) rendered on phones |
| 7 | Flexibility and Efficiency | 1 | Zero mobile touch gestures (double-tap seek, swipe volume/brightness); no edge-to-edge mode |
| 8 | Aesthetic and Minimalist Design | 1 | Extreme cognitive and visual clutter: 16 simultaneous buttons across header and wrapped bottom bar |
| 9 | Error Recovery | 2 | Drawer dismissal triggers accidental video scrub or pauses |
| 10 | Help and Documentation | 2 | Desktop hotkey modal shown to touch users who have no physical keyboard |
| **Total** | | **14/40** | **Poor (35% — Urgent Intervention Required)** |

## Design Specificity Verdict

**Verdict:** Severe Category-Interchangeable Desktop Cramdown.

**Telemetry & Browser Evidence (Live Measurements):**
- **375×812 Viewport (iPhone 13 Mini / X):**
  - `.stage` is constrained to `355px × 199.7px` (only 24.6% of vertical viewport height).
  - `.controls` HUD expands to `186.0px` tall (**93.1% of `.stage` height**).
  - Only **13.7px** of video content remains visible when the HUD is displayed.
  - The `.row` flex container wraps 11 desktop controls across **5 line wraps** (`play`, `mute`, `prevEp`, `nextEp`, `speedBtn`, `time`, `ccBtn`, `settingsBtn`, `theaterBtn`, `fs`, `spacer`).
  - Header consumes **95px** with 4 wrapped pills (`#audioToggle`, `#ccTop`, `#epListBtn`, `#pill`).
- **390×844 Viewport (iPhone 14/15/16):**
  - `.stage` is `370px × 208.1px`; `.controls` is `186.0px` (**89.4% of stage**).
  - Only **22.1px** of video visible through the controls layer.
- **Touch Target Deficits:**
  - `#speedBtn`: 36px × 38px (fails Apple HIG 44×44px and WCAG 2.5.5).
  - `#time`: 34px height.
  - Header actions: 36px height.
- **Desktop Artifacts on Mobile:**
  - `#theaterBtn` ("Theater mode `T`") is rendered despite having zero architectural meaning on mobile portrait.
  - Desktop keyboard shortcut help table rendered on touch devices.

---

## What's Working
1. **Underlying HLS & Audio Core:** The HLS.js streaming engine, Sub/Dub audio track swapping, and time persistence function reliably under the hood.
2. **Obsidian Palette Consistency:** Dark slate `#0a0c10` and bioluminescent cyan `#3dd6c6` tokens match `DESIGN.md`.
3. **Responsive Media Queries Present:** Media queries exist (`@media (max-width: 640px)`), but they only shrink fonts rather than restructuring the viewport architecture.

---

## Priority Issues

### [P0] Viewport Suffocation: 16/9 Postcard in a Void with 93% Controls Occlusion
- **Location:** `src/handlers/pages/watch.ts` (`.page`, `.stage`, `.controls`)
- **Telemetry:** Controls take 186px out of 199.7px stage. 75.4% of mobile screen is dead space.
- **Why it matters:** Users can barely see the anime. Activating controls effectively turns the screen pitch black with stacked buttons.
- **Fix:** 
  1. Break `.stage` out of `.page` padding on mobile (`width: 100vw; margin: 0; left: 0; position: sticky; top: 0; z-index: 100`).
  2. Implement an edge-to-edge top player (YouTube/Crunchyroll model).
  3. Relocate anime metadata, episode selector, and comments/details into the scrollable body below the video.

### [P0] Clipped Drawer Trap: Settings & Episodes Truncated to <140px
- **Location:** `src/handlers/pages/watch.ts` (`#settingsMenu`, `#epPanel`)
- **Telemetry:** Both drawers are `position: absolute` inside `.stage` which has `overflow: hidden`.
- **Why it matters:** On a 200px stage, the episodes drawer is clipped to 140px height, displaying only 2 episodes at a time in a claustrophobic sliver. Subtitle styling dropdowns in settings get sliced off.
- **Fix:** Elevate episode picker and settings into a native mobile bottom-sheet modal or off-canvas drawer anchored to the viewport (`100dvh`), with backdrop blur and swipe-down dismiss.

### [P1] 11-Button Controls Row Chaos & Accidental Touches
- **Location:** `src/handlers/pages/watch.ts` (`.controls .row`)
- **Telemetry:** Flex wrapping creates 3 to 5 jagged rows of controls.
- **Why it matters:** Tapping `#speedBtn` (36×38px) frequently hits the seek bar directly above it (y-delta < 5px), jumping the user to an arbitrary timestamp.
- **Fix:** 
  1. Distill HUD bottom row on mobile to strictly 4 primary controls: **[Time]** · *[Seek Bar]* · **[CC]** · **[Fullscreen]**.
  2. Move Speed, Sub/Dub, Quality, and Subtitle Presets into the unified Settings Bottom Sheet.
  3. Remove `#theaterBtn` on touch devices via `@media (pointer: coarse)`.

### [P1] Broken Touch Mental Model: Tap-to-Pause instead of Tap-to-Reveal
- **Location:** `src/handlers/pages/watch.ts` (`video.onclick = togglePlay`)
- **Why it matters:** On mobile, touching the video immediately pauses the show. Users cannot check the remaining time or reveal controls without halting playback. Furthermore, rapid seeking requires dragging a tiny 10px track.
- **Fix:**
  1. Single tap toggles HUD visibility (with 3.5s autohide timer).
  2. Double tap left side jumps -10s with ripple animation; double tap right side jumps +10s.
  3. Center stage gets a dedicated floating Play/Pause indicator.

---

## Persona Red Flags
- **Maya (The Metro Commuter):** Holding phone in one hand while standing on the subway; tries to unpause after looking up at her stop, but her thumb hits `#nextEpBar` instead of play, completely losing her place in the episode.
- **Alex (The Bedtime Binge-Watcher):** Wants to browse the next 5 episodes without interrupting current playback; opens `#epListBtn` and is greeted with a tiny 130px clipped box where scrolling constantly triggers page scroll.
- **Jordan (The Subtitle Purist):** Tries to change subtitle styling on phone; the dropdown opens downwards and is completely cut off by the stage's `overflow: hidden`.

---

## Provocative Design Questions
1. *Should AniWatch adopt the YouTube/Crunchyroll portrait layout: fixed 16:9 player pinned at the top (`100vw`, 0px padding), with a segmented tab bar below for "Episodes", "Details", and "Settings"?*
2. *Should we replace all nested player popovers on mobile with a standardized iOS/Android bottom-sheet drawer (`role="dialog"` with sheet handle)?*
3. *Should double-tap ±10s seek be introduced with an anime-styled neon ripple effect on left/right touch zones?*

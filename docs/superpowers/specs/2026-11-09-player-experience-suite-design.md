# Player Experience & Binge-Watching Suite Design Specification

**Date:** 2026-11-09  
**Branch:** `feat/player-experience-suite`  
**Status:** Approved  
**Author:** AI Pair Programmer & BKM  

---

## 1. Executive Summary & Goals

Ani-Watch's core streaming engine is now multi-provider resilient (`HD-1`, `HD-2`, `Zoko`, `Gogo`). However, episodic viewing and interactive player ergonomics still lag behind premium streaming platforms like **Netflix**, **Crunchyroll**, **HiAnime**, and **YouTube**.

This specification defines the architecture, components, and interfaces for the **Player Experience Suite**:
1. **Automation Suite**: Opt-in **Auto-Skip Intro & Outro** with Action OSD toasts, **Auto-Next Episode Switch** in Settings, a modern **5-second countdown** (replacing the legacy 12s timer), and a smart **Outro Credits Floating Prompt** (`Next Episode in 5s [Play Now] [✕]`).
2. **Audio & Subtitle Upgrades**: Client-side **Stable Volume Normalizer** (`AudioContext` + `DynamicsCompressorNode`) to tame dynamic volume spikes, real-time **Subtitle Sync Offset** slider (`-2.0s` to `+2.0s`) with `Z` / `X` shortcuts, and global **Sub/Dub language preference persistence**.
3. **Mobile & Touch Gestures**: Mobile **Double-Tap Left/Right Ripple Waves** (`±10s` compounding to `20s`, `30s`), **Double-Tap Center Fullscreen**, and **Press-and-Hold 2.0x Speed Boost** with top pill HUD indicator.
4. **Navigation & Progress Continuity**: Micro **Watched Progress Bars** on episode cards in both the episode drawer and browse page, along with **YouTube/Vim standard hotkeys** (`J`, `K`, `L`, `M`, `C`, `N`, `P`).

---

## 2. Architecture & Subsystems

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Ani-Watch Player Stage                          │
├────────────────────────────────────────────────────────────────────────┤
│  Top Action OSD HUD  ("⚡ Auto-skipped Intro", "2.0x ▶▶", "Sub: +0.2s")  │
├────────────────────────────────────────────────────────────────────────┤
│  Touch & Gesture Layer:                                                │
│  - Double-Tap Left (◀◀ 10s)  - Center (Fullscreen)  - Right (10s ▶▶)   │
│  - Press-and-Hold (2.0x Boost until release)                           │
├────────────────────────────────────────────────────────────────────────┤
│  Video & Web Audio Pipeline:                                           │
│  <video> ──► MediaElementAudioSourceNode ──► DynamicsCompressorNode ──► Destination
├────────────────────────────────────────────────────────────────────────┤
│  Automation Engine:                                                    │
│  - Auto-Skip intro/outro ranges (localStorage: ani.autoSkip)           │
│  - Outro Trigger -> Floating Badge ("Next in 5s [Play]")               │
│  - Ended Event   -> 5s Autoplay Countdown (localStorage: ani.autoNext) │
├────────────────────────────────────────────────────────────────────────┤
│  Subtitle Timing Layer:                                                │
│  renderCcAt(currentTime + subOffset) (localStorage: ani.subOffset)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Detailed Specifications

### 3.1. Automation Engine (`src/handlers/pages/watch.ts`)

#### A. Auto-Skip Intro & Outro
- **State & Storage**: `localStorage.getItem('ani.autoSkip') === '1'`. Default is `'0'` (off).
- **Settings UI**: Renders an accessible `#autoSkipToggle` switch row in `#settingsMenu`:
  ```html
  <div class="menu-row">
    <label id="autoSkipLabel" for="autoSkipToggle">Auto-skip intro & outro</label>
    <button type="button" class="switch" id="autoSkipToggle" role="switch" aria-labelledby="autoSkipLabel"></button>
  </div>
  ```
- **Execution Hook (`timeupdate`)**:
  - In `timeupdate`, if `autoSkipEnabled` and `video.currentTime >= pack.intro.start && video.currentTime < pack.intro.end`:
    - `video.currentTime = pack.intro.end;`
    - `showOsd('⚡', 'Auto-skipped Intro');`
  - If `autoSkipEnabled` and `video.currentTime >= pack.outro.start && video.currentTime < pack.outro.end`:
    - If `nextPlaySafe` exists: trigger the smart Outro prompt or seek to `pack.outro.end`.

#### B. Smart Auto-Next & Outro Floating Badge
- **State & Storage**: `localStorage.getItem('ani.autoNext') !== '0'`. Default is `'1'` (on).
- **Settings UI**: `#autoNextToggle` switch in `#settingsMenu`.
- **Outro Floating Badge**:
  - When `timeupdate` enters `pack.outro.start` and `nextPlaySafe` exists:
    - Render `#outroBadge` sliding up from bottom-right (above controls):
      ```html
      <div id="outroBadge" class="outro-badge" hidden>
        <span>Next episode in <b class="ap-count">5</b>s</span>
        <button type="button" class="pill" id="outroPlayNow">Play Now</button>
        <button type="button" class="outro-dismiss" id="outroDismiss" aria-label="Dismiss">✕</button>
      </div>
      ```
    - Starts a 5-second countdown. If user clicks "Play Now" or timer expires without cancellation, navigates to `nextPlaySafe`.
    - If user clicks "✕" (or presses `Esc`), badge hides, marks `outroDismissed = true`, and playback continues undisturbed.
- **Video Ended Event**:
  - Legacy 12-second countdown reduced to **5 seconds**.
  - Space or Enter immediately executes playback transition. Esc cancels.

---

### 3.2. Audio Normalization & Subtitle Synchronization

#### A. Stable Volume Normalizer (Web Audio API)
- **Web Audio Graph**:
  ```javascript
  var audioCtx = null;
  var compressor = null;
  function initAudioNormalizer() {
    if (audioCtx) return;
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
      var source = audioCtx.createMediaElementSource(video);
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, audioCtx.currentTime); // dB
      compressor.knee.setValueAtTime(30, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
      source.connect(compressor);
      compressor.connect(audioCtx.destination);
    } catch (e) {
      console.warn('[StableVolume] Web Audio init failed:', e);
    }
  }
  ```
- **State & Storage**: `localStorage.getItem('ani.stableVolume') === '1'`.
- **Settings Switch**: `#stableVolumeToggle` in `#settingsMenu` with tooltip: `"Balances quiet dialogue and loud action scenes"`.

#### B. Subtitle Sync Offset
- **State & Storage**: `ani.subOffset` stored as numeric seconds (e.g. `+0.2`, `-0.5`). Clamped to `[-2.0, 2.0]`.
- **Rendering Integration**: In `renderCcAt(t)`, query cues using `effectiveTime = t + subOffset`.
- **Settings UI**: Slider in Subtitle settings:
  ```html
  <div class="menu-row cc-setting-row" style="flex-direction:column;align-items:stretch;gap:6px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span class="cc-label">Subtitle Sync</span>
      <span class="hint" id="ccOffsetLabel">0.0s</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <input class="menu-slider" id="ccOffset" type="range" min="-2.0" max="2.0" step="0.1" value="0.0" />
      <button type="button" class="pill" id="ccOffsetReset" style="font-size:0.75rem;padding:2px 8px">Reset</button>
    </div>
  </div>
  ```
- **Keyboard Shortcuts**: `Z` subtracts 0.1s (delays subtitle), `X` adds 0.1s (advances subtitle), flashing `Sub Sync: +0.2s` in OSD HUD.

#### C. Global Audio Language Preference
- When toggling Sub or Dub on any episode, write `localStorage.setItem('ani.audioPref', track)`.
- On initial page load or browse cinema open, prioritize `localStorage.getItem('ani.audioPref')` if available on the episode.

---

### 3.3. Mobile & Touch Gestures (`src/handlers/pages/watch.ts`)

#### A. Double-Tap Seek with Animated Ripple Waves
- Left 33% bounds: Seeks backward 10s.
- Right 33% bounds: Seeks forward 10s.
- Consecutive double-taps within 650ms compound: `10s` $\rightarrow$ `20s` $\rightarrow$ `30s` $\rightarrow$ `40s`.
- Renders glowing CSS ripple container `#seekRippleOverlay`:
  - Circular wave expanding from touch coordinates with text `◀◀ 10s` or `10s ▶▶`.

#### B. Press-and-Hold 2.0x Speed
- If user holds touch on video stage for $> 400$ms without moving $> 10$px:
  - Cache current `savedRate = video.playbackRate`.
  - Set `video.playbackRate = 2.0`.
  - Render top HUD pill `#holdSpeedPill`: `2x ▶▶`.
  - On `touchend` or `touchcancel`: restore `video.playbackRate = savedRate`, hide pill.

#### C. Double-Tap Center
- Double-tapping between 33% and 66% width toggles Fullscreen.

---

### 3.4. Navigation Continuity & Progress Bars

#### A. Watched Progress Bars
- On `timeupdate`, if `video.duration > 10`:
  - Store `ani.progress.<animeId>.<epNum> = { time: Math.floor(video.currentTime), dur: Math.floor(video.duration), ratio: (video.currentTime / video.duration) }`.
- When rendering episode drawers (`#epPanel`) and browse cards:
  - Read `ani.progress.<animeId>.<epNum>`.
  - Render a 2.5px bottom accent bar `.ep-progress-bar` with width `${ratio * 100}%`.
  - If `ratio >= 0.9` or episode is in `ani.watched`, display a subtle green completion checkmark `✓`.

#### B. Standard YouTube / Vim Keyboard Shortcuts
- Documented in `#shortcutsModal` and active in keydown listeners:
  - `J`: Seek -10s
  - `K`: Play / Pause
  - `L`: Seek +10s
  - `M`: Toggle Mute
  - `C`: Toggle English CC
  - `N`: Next Episode
  - `P`: Previous Episode
  - `Z` / `X`: Subtitle Sync -0.1s / +0.1s

---

## 4. Verification & Testing Plan

1. **Unit Tests (Vitest)**:
   - `tests/handlers/watchAutomation.test.ts`: Auto-skip intro/outro execution, auto-next 5s countdown, smart outro floating badge.
   - `tests/handlers/watchAudioSubUpgrades.test.ts`: Web Audio dynamics compressor initialization, subtitle offset math, `Z`/`X` shortcut handlers.
   - `tests/handlers/watchTouchGestures.test.ts`: Double-tap ripple coordinates, compound seeking, hold-to-2x speed lifecycle.
   - `tests/handlers/watchProgressShortcuts.test.ts`: Episode progress bar markup, YouTube/Vim standard hotkeys.
2. **Mobile Browser Specs (Playwright)**:
   - `tests/mobile/player-gestures.spec.ts`: Real browser touch dispatch verifying double-tap seek, 2x hold accelerator, and safe controls visibility.
3. **TypeScript & Bundling**:
   - `npm run type-check`: Zero errors.
   - `npm test`: 100% pass rate.
   - `node build-vercel.mjs`: Verify production build.

---
name: ani.watch
description: Educational scrape API + browse UI + HTML player
colors:
  primary: "#3dd6c6"
  primary-dim: "rgba(61, 214, 198, 0.16)"
  danger: "#ff7b72"
  favorite: "#ff5f7e"
  warning: "#ffb454"
  warning-dim: "rgba(255, 180, 84, 0.12)"
  ambient-slate: "rgba(70, 100, 180, 0.12)"
  neutral-bg: "#07090d"
  neutral-surface: "#0a0c10"
  neutral-panel: "rgba(12, 16, 24, 0.88)"
  neutral-text: "#e8edf5"
  neutral-muted: "#8b95a8"
  neutral-border: "rgba(255, 255, 255, 0.1)"
typography:
  display:
    fontFamily: "Syne, sans-serif"
    fontSize: "clamp(1.55rem, 3vw, 2.05rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Syne, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"DM Sans", system-ui, sans-serif'
    fontSize: "0.9rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: '"DM Sans", system-ui, sans-serif'
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: '"DM Sans", system-ui, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary-dim}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "rgba(61, 214, 198, 0.28)"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  card-media:
    backgroundColor: "rgba(255, 255, 255, 0.025)"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "0"
  input-field:
    backgroundColor: "rgba(0, 0, 0, 0.32)"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
---

# Design System: ani.watch

## Overview

**Creative North Star: "The Obsidian Cinema"**

ani.watch treats streaming anime as an immersive, theater-grade experience. Set against deep obsidian backdrops, the interface recedes into darkness so that vibrant anime key art, cinematography, and typography remain the undisputed focal point. Every chrome element—from sticky filter docks to in-player episode drawers—is designed with restraint, using translucent frosted glass and subtle atmospheric gradients rather than heavy structural borders.

The visual language stands in stark defiance of traditional anime streaming websites: it explicitly rejects flashing banners, deceptive play/download buttons, neon visual noise, and abrasive third-party advertisements. Instead, interactions are quiet, fluid, and purposeful. When the user interacts with filters or player controls, the interface responds with crisp bioluminescent cyan illumination that signals focus without shattering night-mode comfort.

**Key Characteristics:**
- **Deep Obsidian Atmosphere**: Dark canvases (`#07090d`, `#0a0c10`) with ambient cyan and slate radial illumination that feel expansive rather than flat.
- **Bioluminescent Focus**: Electric cyan (`#3dd6c6`) used sparingly as an active beacon for current selections and player progress.
- **Continuous Pill Geometry**: Interactive buttons, category filters, and mode toggles share a unified rounded capsule silhouette (`999px`).
- **Frosted Translucency**: High-blur backdrops (`blur(18px)`) with delicate semi-transparent white lines (`rgba(255, 255, 255, 0.1)`) that layer depth naturally.

## Colors

The palette is tuned for long viewing sessions in darkened environments: pitch-black foundations paired with a singular bioluminescent accent and soft muted neutrals.

### Primary
- **Bioluminescent Cyan** (`#3dd6c6` / `rgba(61, 214, 198, 0.16)` dim): The signature brand and focus accent. Applied to active filter pills, brand dot mark, player timeline progress, and interactive hover outlines.
- **Cyan Dim** (`rgba(61, 214, 198, 0.16)`): Background wash for primary action pills and active category chips.

### Secondary
- **Soft Coral Warning** (`#ff7b72`): Semantic alert state for stream failures, missing video tokens, or offline providers.
- **Neon Rose** (`#ff5f7e`): Dedicated accent for favorite toggles and active watchlist markers.

### Neutral
- **Ink White** (`#e8edf5`): Primary text color for episode names, anime titles, active tabs, and player timecodes.
- **Muted Slate** (`#8b95a8`): Secondary text for bylines, duration indicators, episode counts, release dates, and inactive labels.
- **Obsidian Void** (`#07090d`): Global root background for browse and landing views.
- **Stage Black** (`#0a0c10` / `#000000`): Deep background for watch pages and letterboxed video playback.
- **Frosted Panel** (`rgba(12, 16, 24, 0.88)`): Backdrop for floating search docks, episode drawers, and modal layers.
- **Ghost Border** (`rgba(255, 255, 255, 0.1)`): Standard structural boundary line separating panels, rails, and cards.

### Named Rules
**The Rarity of Glow Rule.** Bioluminescent Cyan is reserved strictly for active toggles, hover intent, and player focus (≤10% of any screen). Its rarity gives it electric impact; saturating containers or backgrounds with cyan is strictly prohibited.

**The Ghost Border Rule.** Surfaces and dividers never use solid opaque grays; borders are strictly translucent white (`rgba(255, 255, 255, 0.1)`), allowing ambient background atmosphere to bleed through naturally.

## Typography

**Display Font:** Syne (with `sans-serif` fallback)  
**Body Font:** DM Sans (with `system-ui, sans-serif` fallback)  
**Subtitle / Timing Font:** Rosario (with `sans-serif` fallback)

**Character:** Syne conveys a sharp, cinematic, avant-garde anime identity through tight geometric letterforms, while DM Sans delivers effortless, frictionless readability for dense episode titles and metadata.

### Hierarchy
- **Display** (Syne 800, `clamp(1.55rem, 3vw, 2.05rem)`, line-height 0.95, letter-spacing `-0.035em`): Site logo brand mark, hero headers, and main catalog title.
- **Headline** (Syne 700, `1.05rem`, line-height 1.2, letter-spacing `-0.02em`): Section rail headers (Trending, Top Airing, Latest Updates).
- **Title** (DM Sans 650, `0.9rem`, line-height 1.3): Anime title on cards, active episode titles in player chrome. Max 2 lines with `-webkit-line-clamp: 2`.
- **Body** (DM Sans 400/500, `0.85rem`, line-height 1.5): Synopsis text, disclaimers, documentation descriptions, and status banners.
- **Label** (DM Sans 600/700, `0.75rem`, letter-spacing `0.04em`, uppercase): Category pills, SUB/DUB badges, episode number tags, and field titles.

### Named Rules
**The Display Restraint Rule.** Syne is reserved exclusively for the site logo, brand signature, and top-level rail headlines. Card titles, episode names, and all interactive controls must strictly use DM Sans for instant legibility.

## Layout

The spatial model balances generous breathing room on high-resolution monitors with compact touch ergonomics on mobile devices.

- **Maximum Stage Boundaries**: Catalog browse containers cap at `1180px` (`--max`); the cinema video stage caps at `1120px` (`--stage-max`).
- **Responsive Padding**: Standard page padding uses fluid scaling `clamp(16px, 3vw, 28px)`.
- **Grid Architecture**: Media grids employ responsive auto-fill columns (`repeat(auto-fill, minmax(148px, 1fr))`) with `14px` gutters, adapting seamlessly from multi-column desktop walls to dual-column mobile feeds.
- **Horizontal Rails**: Scroll-snapping carousel rails (`gap: 12px`, snap-type `x mandatory`) with fixed card widths (`138px` desktop, `120px` mobile).
- **Sticky Search Dock**: Pinned near the top viewport (`top: 10px`, z-index `20`) with frosted glassmorphism so discovery tools remain immediately accessible while browsing.

## Elevation & Depth

ani.watch uses ambient tonal layering and luminous refraction rather than heavy opaque drop-shadows. Surfaces rest flush on the dark canvas and gain elevation strictly through blurred translucency and subtle colored ambient backlights.

### Shadow Vocabulary
- **Card Hover Elevation** (`box-shadow: 0 20px 44px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(61, 214, 198, 0.15)`): Diffuse shadow combined with a delicate cyan halo applied when hovering or focusing an anime card.
- **Dock Elevation** (`box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35)`): Ambient soft drop under sticky search and navigation containers.
- **Stage Cinematic Shadow** (`box-shadow: 0 0 0 1px var(--line), 0 30px 80px rgba(0, 0, 0, 0.55)`): Deep theater drop around the 16:9 video viewport.

### Named Rules
**The Cinema-First Rule.** The media stage and cover art always maintain higher visual prominence and contrast than the UI chrome framing them. Ambient shadows and blurred backdrops soften the environment to pull the eye directly into the frame.

## Shapes

The form system pairs continuous pill geometry for interactive actions with softly radiused rectangles for content surfaces.

- **Pill Capsules** (`border-radius: 999px`): Buttons, search filter pills, audio selector toggles, pagination triggers, and scrollbar thumbs.
- **Media Cards** (`border-radius: 14px`): Anime poster cards with continuous image clipping and bottom metadata padding.
- **Input Fields & Containers** (`border-radius: 12px` / `16px`): Search bars, password inputs, and docked control panels.
- **Video Stage** (`border-radius: 18px`): The main 16:9 theater screen, transitioning smoothly into sharp corners only during full-screen playback.

## Components

### Buttons
- **Shape:** Full pill capsule (`border-radius: 999px`).
- **Primary:** Background in cyan wash (`rgba(61, 214, 198, 0.16)`), text in bioluminescent cyan (`#3dd6c6`), subtle border (`rgba(61, 214, 198, 0.35)`), padding `8px 14px` (compact) or `12px 18px` (prominent).
- **Hover / Focus:** Lifts slightly (`translateY(-1px)`), background deepens to `rgba(61, 214, 198, 0.28)`, text sharpens to white (`#e8edf5`).
- **Ghost:** Transparent background, white text (`#e8edf5`), border `1px solid rgba(255, 255, 255, 0.1)`.

### Chips & Filter Pills
- **Style:** Compact pill capsule with `font-size: 0.82rem`, semi-transparent background (`rgba(255, 255, 255, 0.03)`), ghost border (`rgba(255, 255, 255, 0.1)`), and muted text (`#8b95a8`).
- **Active State (`.is-active`):** Glows with cyan text (`#3dd6c6`), cyan-dim background (`rgba(61, 214, 198, 0.16)`), and border `rgba(61, 214, 198, 0.35)`.

### Cards / Media Posters
- **Corner Style:** Rounded `14px`, overflow hidden.
- **Background:** Subtle translucent white tint (`rgba(255, 255, 255, 0.025)`) with ghost border (`1px solid rgba(255, 255, 255, 0.1)`).
- **Poster Ratio:** 3 / 4.2 aspect ratio with image fill (`object-fit: cover`).
- **Hover State:** Smooth lift (`translateY(-5px) scale(1.01)`), border shifts to cyan (`rgba(61, 214, 198, 0.5)`), title text transitions to cyan (`#3dd6c6`).

### Inputs & Search Fields
- **Style:** Inset field with dark base (`rgba(0, 0, 0, 0.32)`), ghost border (`rgba(255, 255, 255, 0.1)`), radius `12px`, padding `12px 14px`, text `#e8edf5`.
- **Focus:** Border illuminates to cyan (`rgba(61, 214, 198, 0.45)`) with a soft focus ring (`box-shadow: 0 0 0 3px rgba(61, 214, 198, 0.16)`).

### Navigation & Header
- **Style:** Horizontal flex bar with logo cluster on the left and quick navigation pills (Browse, API, Docs) on the right.
- **Brand Signature:** Lowercase brand name with cyan period (`ani.watch`), accompanied by subtle credit (`by wab`).

### Signature Component: Segmented Audio Pill Toggle (Sub / Dub)
- **Container:** Capsule frame (`padding: 4px`, `border-radius: 999px`, background `rgba(255, 255, 255, 0.06)`, border `1px solid rgba(255, 255, 255, 0.12)`).
- **Pills:** Borderless capsule buttons. Inactive buttons remain muted slate (`#8b95a8`); the active selection pops with cyan-dim background and bright cyan lettering.

## Do's and Don'ts

### Do:
- **Do** maintain deep obsidian canvas darkness (`#07090d` / `#0a0c10`) to preserve night-viewing comfort.
- **Do** use continuous capsule pill geometry (`border-radius: 999px`) for all action triggers, filters, and audio toggles.
- **Do** reserve Bioluminescent Cyan (`#3dd6c6`) for active selection, focus rings, and primary intent.
- **Do** use Syne strictly for top-level brand and rail headings, keeping all dense content in DM Sans.
- **Do** apply `backdrop-filter: blur(18px)` on floating panels and sticky docks to blend foreground controls with scrolling posters.

### Don't:
- **Don't** add third-party advertising banners, blinking badges, or simulated download buttons anywhere in the interface.
- **Don't** use solid gray opaque borders or harsh white dividers; all dividing lines must use translucent white (`rgba(255, 255, 255, 0.1)`).
- **Don't** oversaturate backgrounds with bright cyan or neon gradients; ambient glow must remain subtle and atmospheric (opacity ≤ 16%).
- **Don't** mix square or sharp button shapes into the interface; maintain soft capsules across all surfaces.
- **Don't** hide or obscure the video player with intrusive overlays during active playback.

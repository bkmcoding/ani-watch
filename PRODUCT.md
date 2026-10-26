# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Primary: Anime viewers seeking a clean, fast, ad-free web interface to discover series and stream episodes directly in their browser without aggressive popups, redirect traps, or clutter.
- Secondary: Developers and Discord bot creators consuming the scrape-backed `/api/v2` JSON endpoints for anime catalog search, episode schedules, and stream source resolution.

## Product Purpose
ani.watch provides an educational, ad-free anime discovery and streaming experience. It pairs a lightweight Hono backend scraper with a distraction-free web client (landing, catalog browse, and custom HTML5 Hls.js player) and edge media proxies that deliver video streams, segments, and subtitles smoothly.

## Positioning
Unlike conventional anime streaming sites laden with intrusive advertisements, deceptive overlays, and sluggish players, ani.watch provides a minimalist, zero-bloat web experience that strips away upstream spam for instant, seamless HLS playback.

## Operating Context
- Modern desktop and mobile web browsers (Chrome, Safari, Firefox, Edge).
- Users browsing trending anime, searching titles, reviewing episode lists, and watching high-definition streams with selectable audio (sub/dub) and subtitle tracks.
- Relies on edge request relaying (Cloudflare Worker or local Node proxy) to overcome CORS and hotlink protections from upstream CDNs.

## Capabilities and Constraints
- Catalog & Discovery: Home trending carousel, schedule overview, genre/tag filters, search with autocomplete, and episode metadata.
- Playback & Streaming: In-browser HTML5 player powered by Hls.js, multi-server selection (HD-1, HD-2 via providers like MegaPlay and Zoko), sub/dub audio categories, in-player episode drawer, and previous/next navigation.
- Streaming Constraints: Live HLS playlists (`.m3u8`) cannot be cached on disk or with long TTLs due to short-lived upstream CDN presigned tokens; relies on zero-storage playlist relay and in-flight request coalescing.
- Educational Scope: Unofficial educational scrape API; does not host media files directly and preserves explicit legal disclaimers.

## Brand Commitments
- Name: `ani.watch`
- Byline / Credit: `by wab`
- Color Palette: Accent teal (`#3dd6c6`), deep background ink (`#07090d`, `#0a0c10`), text (`#e8edf5`), muted slate (`#8b95a8`).
- Typography: `Syne` for brand and prominent headings, `DM Sans` for UI copy, navigation, and body text.
- Brand Mark: Dark rounded square with lowercase 'a' and accent teal dot (`docs/logo.svg`, `src/lib/brand.ts`).

## Evidence on Hand
- Functional pages: Landing page at `/`, catalog browse interface at `/browse`, embedded HTML player at `/api/v2/hianime/watch`.
- Streaming proxy architecture documented in `docs/adr/0001-media-proxy-architecture.md`.
- Playback vocabulary and naming rules standardized in `GLOSSARY.md`.
- Shared brand constants and SVG icon generator in `src/lib/brand.ts`.

## Product Principles
- **Distraction-Free Immersion**: The viewing experience is paramount—never inject third-party ads, deceptive buttons, or clutter between the user and their anime.
- **Instant Response**: Lean server-rendered markup, lightweight vanilla JavaScript, and immediate HLS stream startup over heavy client framework overhead.
- **Graceful Resilience**: Transparent server and stream fallback indicators when third-party upstream providers fail or rotate tokens.
- **Ergonomic Media Controls**: Seamless keyboard navigation, responsive mobile scaling, and immediate sub/dub toggling.

## Accessibility & Inclusion
- High-contrast visual cues compliant with WCAG AA against dark backgrounds.
- Accessible player controls with visible focus states and keyboard shortcuts.
- Support for clear, legible subtitle tracks (WebVTT/ASS) with customizable styling.

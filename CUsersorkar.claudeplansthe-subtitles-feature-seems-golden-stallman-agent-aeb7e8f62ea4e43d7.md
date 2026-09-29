# Subtitles Feature Exploration

## Overview
The subtitles feature in ani-watch provides English closed captions (CC) for videos. The system retrieves subtitle tracks from video providers (MegaPlay and Zoko), selects the best English subtitle using `pickEnglishSubtitle`, and proxies the subtitle file via the HLS proxy endpoint (which also handles VTT/ASS files). The video player then fetches the proxied subtitle URL, parses it as VTT, and renders captions via a custom CC layer.

## Key Files
- `src/services/zoko.ts` – Zoko subtitle extraction
- `src/services/megaplay.ts` – MegaPlay subtitle extraction
- `src/lib/streamUrls.ts` – `pickEnglishSubtitle` (selects English VTT) and URL building
- `src/handlers/pages/watch.ts` – Video player HTML/JS, includes CC logic and VTT parsing
- `src/handlers/media/hlsProxy.ts` – Proxies media and subtitle files (handles VTT/ASS)
- `src/services/episodeSources.ts` – Aggregates streams and subtitles for episode playback

## Identified Issues

### 1. Limited Language Support
Only English subtitles are exposed via the CC toggle. Users cannot select subtitles in other languages, even if available from the provider. The UI lacks a language menu.

### 2. Potential False Positives in English Detection
`pickEnglishSubtitle` scores subtitles by matching the `lang` field (or label) against English patterns (`/^(en|eng|english)([-_]|$)/i` or `/\benglish\b/i`). A non-English subtitle labeled with an English word (e.g., "English" but actually French) could be incorrectly selected.

### 3. Inconsistent `lang` Field in Subtitle Objects
- MegaPlay: `lang` is set to the track's `label` (not a language code).
- Zoko: `lang` is set to `t.label || t.lang || 'Unknown'` (may be a code or label).
This inconsistency could cause confusion if the `lang` field is assumed to be a language code elsewhere.

### 4. Player Only Supports VTT Subtitles
The player's `parseVtt` function expects WebVTT format. If an ASS subtitle is somehow provided (e.g., via manual `subCc`/`dubCc` query parameters), the player will fail to render it correctly. The current selection mechanism only picks VTT, so this is theoretical but possible if bypassed.

### 5. No UI for Subtitle Language Selection
The CC toggle is a simple on/off for English. There is no way to:
  - View available subtitle languages
  - Switch to a non-English subtitle
  - Adjust caption styling beyond size/position (though those are present)

### 6. Underutilized Subtitle Data
The `episodeSources.resolveEpisodePlayback` function returns a `tracks` object containing all subtitle tracks per language/provider, but the player page (`/watch`) does not use this data. It only receives the English subtitle URL via query parameters.

## Recommendations
1. Add a subtitle language menu to the player settings, populated from the `tracks` object.
2. Improve English detection by checking for known language codes (e.g., `en`, `eng`) first, then fall back to label matching.
3. Standardize the `lang` field to always be a language code (ISO 639-2/B or similar), using the label only as a fallback for display.
4. Consider adding ASS subtitle support to the player (using a library like `subtitle` or converting to VTT) if needed.
5. Ensure the proxy correctly handles subtitle caching and headers (already appears fine).

## Conclusion
The subtitles feature works well for English CC but lacks multi-language support and has some inconsistencies in data handling. Addressing the above issues would improve accessibility and user experience.

import { Context } from 'hono';
import { validationError } from '../../lib/errors';
import { proxiedHlsUrl, proxiedVttUrl, requestOrigin, watchPlayUrl } from '../../lib/streamUrls';
import { faviconLinkTags, SITE_NAME, titleFromAnimeSlug } from '../../lib/brand';
import { NOTICE_SHORT } from '../../lib/notices';
import { vercelObservabilityScriptTags } from '../../lib/vercelObservability';

function parseAllowedUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // Only require https:// — the HLS proxy enforces the CDN allowlist when
    // the URL is actually fetched, so double-checking here just breaks on new CDN hostnames.
    if (u.protocol !== 'https:' || !u.hostname || u.hostname.length < 3) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Accepts any https:// URL for subtitle/CC tracks — the HLS proxy enforces CORS
 *  and the VTT payload itself is harmless text. Stream URLs remain strictly gated. */
function parseCcUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (!u.hostname || u.hostname.length < 3) return null;
    return u.href;
  } catch {
    return null;
  }
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeJson(val: unknown): string {
  return JSON.stringify(val)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function parseEpisodeIdParam(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/::/g, '?');
  if (!cleaned || cleaned.length > 220) return null;
  if (/[\s<>"']/.test(cleaned)) return null;
  return cleaned;
}

type SkipRange = { start: number; end: number } | null;

function parseSkipSec(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseSkipRange(startRaw: string | undefined, endRaw: string | undefined): SkipRange {
  const start = parseSkipSec(startRaw);
  const end = parseSkipSec(endRaw);
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

function parseProviderId(raw: string | undefined): 'megaplay' | 'zoko' | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'megaplay' || v === 'mega' || v === 'hd-1' || v === 'hd1') return 'megaplay';
  if (v === 'zoko') return 'zoko';
  return null;
}

function providerDisplayName(id: string | null | undefined): string {
  if (id === 'megaplay') return 'MegaPlay';
  if (id === 'zoko') return 'Zoko';
  return '';
}

const watchController = async (c: Context) => {
  const subCdn = parseAllowedUrl(c.req.query('sub') || undefined);
  const dubCdn = parseAllowedUrl(c.req.query('dub') || undefined);
  const legacy = parseAllowedUrl(c.req.query('url') || undefined);
  const subCcCdn = parseCcUrl(c.req.query('subCc') || undefined);
  const dubCcCdn = parseCcUrl(c.req.query('dubCc') || undefined);
  const preferredRaw = (c.req.query('t') || 'sub').toLowerCase();
  const animeTitle =
    c.req.query('title')?.trim() || titleFromAnimeSlug(c.req.query('anime') || undefined);
  const animeId = (c.req.query('anime') || '').trim() || null;
  const epNum = c.req.query('n') || null;
  const epTitle = c.req.query('epTitle')?.trim() || null;
  const epIndex = c.req.query('i') || null;
  const epTotal = c.req.query('total') || null;
  const prevEpisodeId = parseEpisodeIdParam(c.req.query('prevEp') || undefined);
  const nextEpisodeId = parseEpisodeIdParam(c.req.query('nextEp') || undefined);
  const legacyPrev = c.req.query('prev') || null;
  const legacyNext = c.req.query('next') || null;
  const subIntro = parseSkipRange(c.req.query('is') || undefined, c.req.query('ie') || undefined);
  const subOutro = parseSkipRange(c.req.query('os') || undefined, c.req.query('oe') || undefined);
  const dubIntro =
    parseSkipRange(c.req.query('dis') || undefined, c.req.query('die') || undefined) || subIntro;
  const dubOutro =
    parseSkipRange(c.req.query('dos') || undefined, c.req.query('doe') || undefined) || subOutro;
  const activeProviderParam = parseProviderId(c.req.query('p') || undefined);
  const subProviderParam = parseProviderId(c.req.query('sp') || undefined);
  const dubProviderParam = parseProviderId(c.req.query('dp') || undefined);

  let resolvedSub = subCdn;
  let resolvedDub = dubCdn;

  // Lone `url=` (older links): map it to the preferred track.
  if (!resolvedSub && !resolvedDub && legacy) {
    if (preferredRaw === 'dub') resolvedDub = legacy;
    else resolvedSub = legacy;
  }

  if (!resolvedSub && !resolvedDub) {
    throw new validationError('sub, dub, or url query param required (allowed CDN hosts only)');
  }

  const initial = preferredRaw === 'dub' && resolvedDub ? 'dub' : resolvedSub ? 'sub' : 'dub';
  const origin = requestOrigin(c);

  function sameOriginPlay(raw: string | null): string | null {
    if (!raw) return null;
    try {
      const u = new URL(raw, origin);
      if (u.origin !== new URL(origin).origin) return null;
      if (!u.pathname.includes('/hianime/watch/play')) return null;
      return u.href;
    } catch {
      return null;
    }
  }

  const category = initial === 'dub' ? 'dub' : 'sub';
  const prevPlaySafe =
    (prevEpisodeId ? watchPlayUrl(origin, prevEpisodeId, category) : null) ||
    sameOriginPlay(legacyPrev);
  const nextPlaySafe =
    (nextEpisodeId ? watchPlayUrl(origin, nextEpisodeId, category) : null) ||
    sameOriginPlay(legacyNext);
  const hasNav = Boolean(prevPlaySafe || nextPlaySafe);
  const hasAnime = Boolean(animeId);
  const streams = {
    sub: resolvedSub ? proxiedHlsUrl(origin, resolvedSub) : null,
    dub: resolvedDub ? proxiedHlsUrl(origin, resolvedDub) : null,
  };
  const captions = {
    sub: subCcCdn ? proxiedVttUrl(origin, subCcCdn) : null,
    dub: dubCcCdn ? proxiedVttUrl(origin, dubCcCdn) : null,
  };
  const skips = {
    sub: { intro: subIntro, outro: subOutro },
    dub: { intro: dubIntro, outro: dubOutro },
  };
  const providers = {
    sub: subProviderParam || (initial === 'sub' ? activeProviderParam : null),
    dub: dubProviderParam || (initial === 'dub' ? activeProviderParam : null),
  };
  if (!providers.sub && !providers.dub && activeProviderParam) {
    providers.sub = activeProviderParam;
    providers.dub = activeProviderParam;
  }
  const initialProvider =
    (initial === 'dub' ? providers.dub : providers.sub) ||
    providers.sub ||
    providers.dub ||
    activeProviderParam;
  const initialProviderLabel = providerDisplayName(initialProvider);
  const hasSub = Boolean(streams.sub);
  const hasDub = Boolean(streams.dub);
  const hasEither = hasSub || hasDub;
  const hasBoth = hasSub && hasDub;
  const hasAnyCc = Boolean(captions.sub || captions.dub);

  const pageTitleParts = [SITE_NAME];
  if (animeTitle && animeTitle !== SITE_NAME) pageTitleParts.unshift(animeTitle);
  if (epNum) pageTitleParts[0] = `${pageTitleParts[0]} · Ep ${epNum}`;
  const pageTitle = escAttr(pageTitleParts.join(' — '));
  const subtitleBits = [
    epNum ? `Episode ${epNum}` : null,
    epIndex && epTotal ? `${epIndex}/${epTotal}` : null,
    epTitle,
  ].filter(Boolean) as string[];
  const hasEpisodeMeta = subtitleBits.length > 0;
  const subtitle = hasEpisodeMeta ? escAttr(subtitleBits.join(' · ')) : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>${pageTitle}</title>
  <meta name="application-name" content="${SITE_NAME}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  ${faviconLinkTags(origin)}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Rosario:wght@700&display=swap" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Rosario:wght@700&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
  <noscript><link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Rosario:wght@700&display=swap" rel="stylesheet" /></noscript>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js" integrity="sha384-9v3HcdYrO3D+OPDTjZ40RXocgE4GtXVCd3/mCS62JsM93JXgI1afJVuwjFvsu6ni" crossorigin="anonymous" defer></script>
  <style>
    :root {
      --bg0: #0a0c10;
      --ink: #e8edf5;
      --muted: #8b95a8;
      --accent: #3dd6c6;
      --accent-dim: rgba(61, 214, 198, 0.18);
      --danger: #ff7b72;
      --line: rgba(255, 255, 255, 0.12);
      --panel: rgba(14, 18, 26, 0.94);
      --radius-sm: 6px;
      --radius-md: 12px;
      --radius-lg: 14px;
      --radius-xl: 18px;
      --radius-pill: 999px;
      --radius: var(--radius-xl);
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
      --stage-max: 1120px;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg0); color: var(--ink); font-family: "DM Sans", system-ui, sans-serif; }
    body {
      min-height: 100dvh;
      animation: fadein 0.3s ease both;
      background:
        radial-gradient(1200px 600px at 50% -10%, rgba(61, 214, 198, 0.12), transparent 55%),
        radial-gradient(900px 500px at 100% 100%, rgba(70, 100, 180, 0.12), transparent 50%),
        linear-gradient(180deg, #0d1118 0%, var(--bg0) 45%, #080a0e 100%);
    }
    @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
    .page {
      min-height: 100dvh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: clamp(16px, 3vw, 28px);
      padding-top: max(clamp(16px, 3vw, 28px), env(safe-area-inset-top));
      padding-bottom: max(clamp(16px, 3vw, 28px), env(safe-area-inset-bottom));
      padding-left: max(clamp(16px, 3vw, 28px), env(safe-area-inset-left));
      padding-right: max(clamp(16px, 3vw, 28px), env(safe-area-inset-right));
      gap: 18px;
      transition: padding 0.35s var(--ease);
    }
    header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      max-width: var(--stage-max); width: 100%; margin: 0 auto;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .brand {
      font-family: Syne, sans-serif; font-weight: 800;
      font-size: clamp(1.55rem, 3vw, 2.05rem); letter-spacing: -0.035em; margin: 0;
    }
    .brand span { color: var(--accent); }
    .brand-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .brand-by {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: lowercase;
      color: var(--muted);
    }
    .brand-by em { font-style: normal; color: var(--accent); font-weight: 600; }
    .ep-line {
      margin: 3px 0 0;
      font-size: 0.78rem;
      color: var(--muted);
      max-width: min(500px, 60vw);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.01em;
    }
    .header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
    .hint { color: var(--muted); font-size: 0.85rem; margin: 0; }
    .pill-toggle {
      display: inline-flex; padding: 4px; border-radius: 999px;
      background: rgba(255,255,255,0.06); border: 1px solid var(--line); gap: 2px;
    }
    .pill-toggle[hidden] { display: none !important; }
    .pill {
      appearance: none; border: 0; background: transparent; color: var(--muted);
      font: inherit; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; padding: 8px 14px; border-radius: 999px; cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
      text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
    }
    .pill:hover { color: var(--ink); }
    .pill.is-active { background: var(--accent-dim); color: var(--accent); }
    .pill:disabled, .pill[aria-disabled="true"] {
      opacity: 0.38;
      cursor: not-allowed;
      pointer-events: none;
    }
    .pill.nav-pill {
      background: var(--accent-dim);
      color: var(--accent);
      border: 1px solid rgba(61,214,198,0.35);
      min-width: 72px;
    }
    .pill.nav-pill:hover { background: rgba(61, 214, 198, 0.3); color: var(--ink); }
    .pill.provider-pill {
      cursor: default;
      pointer-events: none;
      text-transform: none;
      letter-spacing: 0.02em;
      background: rgba(255,255,255,0.05);
      color: var(--muted);
      border: 1px solid var(--line);
      font-weight: 500;
    }
    .pill.provider-pill[hidden] { display: none !important; }
    a.pill[aria-disabled="true"] { opacity: 0.35; pointer-events: none; }
    /* Accessible focus rings */
    .pill:focus-visible,
    .ctrl:focus-visible,
    .big-btn:focus-visible,
    .skip-btn:focus-visible,
    .speed-chip:focus-visible,
    .switch:focus-visible,
    .cc-font-btn:focus-visible,
    .cc-swatch:focus-visible,
    .menu select:focus-visible,
    .menu-slider:focus-visible,
    .ep-item:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .seek:focus-visible,
    .vol:focus-visible {
      outline: none;
    }
    .seek:focus-visible::-webkit-slider-thumb,
    .vol:focus-visible::-webkit-slider-thumb {
      box-shadow: 0 0 0 4px var(--accent-dim), 0 0 0 2px var(--accent);
    }
    .seek:focus-visible::-moz-range-thumb,
    .vol:focus-visible::-moz-range-thumb {
      box-shadow: 0 0 0 4px var(--accent-dim), 0 0 0 2px var(--accent);
    }
    .stage-wrap { display: grid; place-items: center; width: 100%; min-height: 0; }
    .stage {
      position: relative;
      width: min(100%, var(--stage-max));
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 0 0 1px var(--line), 0 30px 80px rgba(0, 0, 0, 0.55);
      isolation: isolate;
      transition: width 0.35s var(--ease), height 0.35s var(--ease), border-radius 0.35s var(--ease), aspect-ratio 0.35s var(--ease);
    }
    video {
      width: 100%; height: 100%; display: block; background: #000;
      object-fit: contain; cursor: pointer;
    }
    .stage.cursor-hidden, .stage.cursor-hidden video { cursor: none; }
    /* Hide any native cue chrome — we render CC ourselves */
    video::cue { opacity: 0 !important; visibility: hidden !important; font-size: 0 !important; }
    .cc-layer {
      position: absolute; inset: 0; z-index: 2; pointer-events: none;
      display: none;
    }
    .cc-layer.is-on { display: block; }
    .cc-box {
      position: absolute;
      left: var(--cc-x, 50%);
      bottom: var(--cc-y, 10%);
      top: auto;
      transform: translateX(-50%);
      max-width: min(88%, 860px);
      width: max-content;
      text-align: center;
      pointer-events: auto;
      cursor: grab;
      user-select: none;
      touch-action: none;
      padding: 0.15em 0.4em;
      border-radius: 6px;
      /* default: no background (outline style) */
      background: var(--cc-bg, transparent);
      color: var(--cc-color, #fff);
      font-family: var(--cc-font-family, "DM Sans", system-ui, sans-serif);
      font-size: var(--cc-size, 34px);
      font-weight: var(--cc-weight, 700);
      line-height: 1.35;
      letter-spacing: 0.01em;
      /* Strong anime-style outline: thick stroke + deep multi-layer shadow */
      -webkit-text-stroke: var(--cc-stroke, 2.5px #000);
      paint-order: stroke fill;
      text-shadow: var(--cc-shadow,
        0 0 6px rgba(0,0,0,1),
        0 2px 6px rgba(0,0,0,1),
        0 4px 12px rgba(0,0,0,0.85),
        2px 2px 0 rgba(0,0,0,0.7),
        -2px 2px 0 rgba(0,0,0,0.7)
      );
      white-space: pre-wrap;
      word-break: break-word;
      opacity: 0;
      transition: opacity 0.1s ease;
    }
    .cc-box.is-visible { opacity: var(--cc-opacity, 1); }
    .cc-box.is-dragging { cursor: grabbing; transition: none; }
    .cc-box:empty { display: none; }
    /* Caption edge/style presets */
    .cc-box[data-style="outline"] {
      background: var(--cc-bg, transparent);
      -webkit-text-stroke: var(--cc-stroke, 2.5px #000);
      text-shadow: var(--cc-shadow,
        0 0 6px rgba(0,0,0,1),
        0 2px 6px rgba(0,0,0,1),
        0 4px 12px rgba(0,0,0,0.85),
        2px 2px 0 rgba(0,0,0,0.6),
        -2px 2px 0 rgba(0,0,0,0.6)
      );
    }
    .cc-box[data-style="raised"] {
      background: var(--cc-bg, transparent);
      -webkit-text-stroke: var(--cc-stroke, 1px rgba(0,0,0,0.8));
      text-shadow: 3px 3px 0 rgba(0,0,0,0.95), -1px -1px 0 rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.9);
    }
    .cc-box[data-style="drop"] {
      background: var(--cc-bg, transparent);
      -webkit-text-stroke: var(--cc-stroke, 1px rgba(0,0,0,0.5));
      text-shadow: 0 4px 10px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,0.9), 2px 4px 8px rgba(0,0,0,0.8);
    }
    .cc-box[data-style="box"] {
      background: var(--cc-bg, rgba(0,0,0,0.82));
      -webkit-text-stroke: 0px transparent;
      text-shadow: none;
      padding: 0.25em 0.65em;
      border-radius: 6px;
    }
    .cc-box[data-style="none"] {
      background: var(--cc-bg, transparent);
      -webkit-text-stroke: 0px transparent;
      text-shadow: none;
    }
    .menu-slider {
      width: 100%;
      appearance: none; height: 6px; border-radius: 999px;
      background: rgba(255,255,255,0.18); outline: none; cursor: pointer;
    }
    .menu-slider::-webkit-slider-thumb {
      appearance: none; width: 14px; height: 14px; border-radius: 50%;
      background: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim);
    }
    .menu-slider::-moz-range-thumb {
      width: 14px; height: 14px; border: 0; border-radius: 50%; background: var(--accent);
    }
    .pos-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .pos-row .pill { flex: 1; text-align: center; padding: 8px 6px; }
    /* CC settings redesign */
    .cc-setting-row { padding: 8px 0; border-bottom: 1px solid var(--line); }
    .cc-setting-row:last-child { border-bottom: none; }
    .cc-label { font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .cc-swatch-row { gap: 8px; }
    .cc-swatch {
      width: 28px; height: 28px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15); cursor: pointer;
      transition: transform 0.12s, border-color 0.12s; flex-shrink: 0;
      position: relative;
    }
    .cc-swatch::after {
      content: ""; position: absolute; inset: -8px; border-radius: 50%;
    }
    .cc-swatch:hover { transform: scale(1.15); }
    .cc-swatch.is-active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-dim); transform: scale(1.1); }
    .cc-font-row { gap: 5px; flex-wrap: wrap; }
    .cc-font-btn {
      flex: 1; min-width: 70px; text-align: center; padding: 7px 6px; font-size: 0.78rem;
      background: var(--surface2, rgba(255,255,255,0.06)); border: 1px solid var(--line);
      border-radius: var(--radius-sm, 6px); color: var(--ink); cursor: pointer; transition: background 0.12s, border-color 0.12s;
    }
    .cc-font-btn:hover { background: rgba(255,255,255,0.12); }
    .cc-font-btn.is-active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
    .overlay {
      position: absolute; inset: 0; display: grid; place-items: center;
      pointer-events: none;
      background: radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.25) 100%);
      opacity: 0; transition: opacity 0.35s var(--ease);
    }
    .stage.is-paused .overlay, .stage.is-loading .overlay { opacity: 1; }
    .big-btn {
      width: 76px; height: 76px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(12, 16, 24, 0.55); backdrop-filter: blur(10px);
      color: var(--ink); display: grid; place-items: center;
      pointer-events: auto; cursor: pointer;
      transition: transform 0.25s var(--ease), background 0.25s ease;
    }
    .big-btn:hover { transform: scale(1.05); background: rgba(61, 214, 198, 0.2); }
    .big-btn svg { width: 28px; height: 28px; }
    .skip-btn {
      position: absolute;
      right: 16px;
      bottom: 88px;
      z-index: 4;
      padding: 10px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.22);
      background: rgba(12, 16, 24, 0.78);
      backdrop-filter: blur(10px);
      color: var(--ink);
      font-family: "DM Sans", system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.22s var(--ease), transform 0.22s var(--ease), background 0.2s ease;
      pointer-events: none;
    }
    .skip-btn.is-visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    .skip-btn:hover { background: rgba(61, 214, 198, 0.28); }
    .stage.is-paused .skip-btn.is-visible,
    .stage.show-controls .skip-btn.is-visible, .stage:focus-within .skip-btn.is-visible {
      opacity: 1;
    }
    /* Auto-play next episode overlay */
    .ap-overlay {
      position: absolute; inset: 0; z-index: 7;
      display: none; align-items: flex-end; justify-content: flex-end;
      padding: 0 16px 72px; pointer-events: none;
    }
    .ap-overlay:not([hidden]) { display: flex; }
    .ap-card {
      background: rgba(0,0,0,0.72); backdrop-filter: blur(12px);
      border: 1px solid var(--line); border-radius: 14px;
      padding: 14px 16px; min-width: 180px; pointer-events: all;
      animation: apIn 0.25s var(--ease);
    }
    @keyframes apIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .ap-label { margin: 0 0 4px; font-size: 0.78rem; color: var(--muted); }
    .ap-count {
      display: block; font-family: Syne, sans-serif; font-size: 2.05rem; font-weight: 800; color: var(--accent);
      line-height: 1; text-align: center; margin-bottom: 4px;
    }

    /* Episode progress dots */
    .ep-item.is-watched .ep-n::before {
      content: ''; display: inline-block; width: 6px; height: 6px;
      border-radius: 50%; background: var(--accent); margin-right: 5px;
      vertical-align: middle; opacity: 0.7;
    }

    .spinner {
      width: 42px; height: 42px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.15); border-top-color: var(--accent);
      animation: spin 0.8s linear infinite; display: none;
    }
    .stage.is-loading .big-btn { display: none; }
    .stage.is-loading .spinner { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .controls {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 56px 14px 12px;
      background: linear-gradient(transparent, rgba(0,0,0,0.88) 50%);
      opacity: 0; transform: translateY(6px);
      transition: opacity 0.28s var(--ease), transform 0.28s var(--ease);
      z-index: 3;
    }
    .stage.is-paused .controls,
    .stage.show-controls .controls, .stage:focus-within .controls,
    .stage.settings-open .controls {
      opacity: 1; transform: translateY(0);
    }
    .seek {
      width: 100%; height: 6px; appearance: none; background: transparent; cursor: pointer; margin: 0 0 10px;
    }
    .seek::-webkit-slider-runnable-track {
      height: 6px; border-radius: 999px;
      background: linear-gradient(90deg, var(--accent) var(--progress, 0%), rgba(255,255,255,0.18) var(--progress, 0%));
    }
    .seek::-webkit-slider-thumb {
      appearance: none; width: 14px; height: 14px; margin-top: -4px;
      border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 4px var(--accent-dim);
    }
    .seek::-moz-range-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.18); }
    .seek::-moz-range-progress { height: 6px; border-radius: 999px; background: var(--accent); }
    .seek::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: var(--ink); }
    .row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .row .spacer { flex: 1; min-width: 8px; }
    .ctrl {
      appearance: none; border: 0; background: transparent; color: var(--ink);
      width: 40px; height: 40px; border-radius: var(--radius-md, 12px);
      display: grid; place-items: center; cursor: pointer; position: relative;
      transition: background 0.2s ease;
    }
    .ctrl:hover, .ctrl.is-on { background: rgba(255,255,255,0.08); }
    .ctrl svg { width: 20px; height: 20px; }
    .time {
      font-variant-numeric: tabular-nums; font-size: 0.82rem;
      color: var(--muted); padding: 0 8px; min-width: 9.5rem;
    }
    .vol { width: 84px; height: 5px; appearance: none; background: transparent; cursor: pointer; }
    .vol::-webkit-slider-runnable-track {
      height: 5px; border-radius: 999px;
      background: linear-gradient(90deg, var(--accent) var(--vol, 100%), rgba(255,255,255,0.18) var(--vol, 100%));
    }
    .vol::-webkit-slider-thumb {
      appearance: none; width: 12px; height: 12px; margin-top: -3.5px;
      border-radius: 50%; background: var(--ink);
    }
    .vol::-moz-range-track { height: 5px; border-radius: 999px; background: rgba(255,255,255,0.18); }
    .vol::-moz-range-progress { height: 5px; border-radius: 999px; background: var(--accent); }
    .vol::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: var(--ink); }
    .speed-chip {
      appearance: none; border: 1px solid var(--line); background: rgba(255,255,255,0.04);
      color: var(--muted); font: inherit; font-size: 0.75rem; font-weight: 600;
      padding: 6px 10px; border-radius: var(--radius-pill, 999px); cursor: pointer; min-width: 42px;
    }
    .speed-chip:hover, .speed-chip.is-active { color: var(--accent); border-color: rgba(61,214,198,0.4); background: var(--accent-dim); }
    .menu {
      position: absolute; right: 12px; bottom: 58px;
      width: min(300px, calc(100% - 24px));
      max-height: min(80dvh, 600px); overflow-y: auto; overflow-x: hidden;
      background: var(--panel); border: 1px solid var(--line);
      border-radius: var(--radius-lg, 14px); padding: 12px; box-shadow: 0 18px 50px rgba(0,0,0,0.45);
      display: none; z-index: 5; backdrop-filter: blur(16px);
      overscroll-behavior: contain;
    }
    .menu.is-open { display: block; }
    .menu h3 {
      margin: 0 0 10px; font-size: 0.72rem; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--muted); font-weight: 600;
    }
    .menu-section { margin-bottom: 14px; }
    .menu-section:last-child { margin-bottom: 0; }
    .menu-row {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 8px 4px; font-size: 0.9rem;
    }
    .menu-row label { color: var(--ink); }
    .menu select, .menu .speed-row {
      width: 100%;
    }
    .menu select {
      appearance: none; border: 1px solid var(--line); background: rgba(255,255,255,0.04);
      color: var(--ink); border-radius: var(--radius-md, 12px); padding: 8px 10px; font: inherit;
    }
    .speed-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .switch {
      position: relative; width: 42px; height: 24px; border-radius: 999px;
      background: rgba(255,255,255,0.12); border: 0; cursor: pointer; padding: 0;
    }
    .switch::after {
      content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
      border-radius: 50%; background: #fff; transition: transform 0.2s var(--ease);
    }
    .switch.is-on { background: rgba(61, 214, 198, 0.55); }
    .switch.is-on::after { transform: translateX(18px); }
    .err {
      max-width: var(--stage-max); width: 100%; margin: 0 auto; color: var(--danger);
      background: rgba(255, 123, 114, 0.08); border: 1px solid rgba(255, 123, 114, 0.25);
      border-radius: 12px; padding: 12px 14px; font-size: 0.92rem;
    }
    footer {
      max-width: var(--stage-max); width: 100%; margin: 0 auto;
      color: var(--muted); font-size: 0.75rem;
      transition: opacity 0.3s ease;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
    footer a:hover { text-decoration: underline; }
    .ep-panel {
      position: absolute; left: 12px; bottom: 58px;
      width: min(340px, calc(100% - 24px));
      max-height: min(52vh, 420px);
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,0.45);
      display: none; z-index: 5; backdrop-filter: blur(16px);
      flex-direction: column; overflow: hidden;
    }
    .ep-panel.is-open { display: flex; }
    .ep-panel-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 12px 12px 8px; border-bottom: 1px solid var(--line);
    }
    .ep-panel-head h3 {
      margin: 0; font-size: 0.72rem; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--muted); font-weight: 600;
    }
    .ep-panel-status { margin: 0; padding: 10px 12px; font-size: 0.82rem; color: var(--muted); }
    .ep-list {
      overflow: auto; overscroll-behavior: contain;
      padding: 6px; display: flex; flex-direction: column; gap: 2px;
    }
    .ep-item {
      appearance: none; border: 0; background: transparent; color: var(--ink);
      font: inherit; text-align: left; cursor: pointer;
      display: grid; grid-template-columns: 3.2rem 1fr; gap: 8px; align-items: start;
      padding: 8px 10px; border-radius: var(--radius-md, 12px); width: 100%;
      transition: background 0.15s ease;
      content-visibility: auto;
      contain-intrinsic-size: auto 36px;
    }
    .ep-item:hover { background: rgba(255,255,255,0.06); }
    .ep-item.is-current { background: var(--accent-dim); color: var(--accent); }
    .ep-item .ep-n { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--muted); }
    .ep-item.is-current .ep-n { color: var(--accent); }
    .ep-item .ep-t {
      font-size: 0.88rem; line-height: 1.3;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ep-item.is-filler .ep-n::after {
      content: "F"; margin-left: 4px; font-size: 0.72rem; opacity: 0.7;
    }

    /* Theater mode */
    body.theater { background: #000; }
    body.theater .page {
      padding: 0;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
      gap: 0;
    }
    body.theater header,
    body.theater footer { opacity: 0; pointer-events: none; height: 0; overflow: hidden; margin: 0; padding: 0; }
    body.theater .stage-wrap { min-height: 100dvh; }
    body.theater .stage {
      width: 100vw; max-width: none; height: 100dvh;
      aspect-ratio: auto; border-radius: 0; box-shadow: none;
    }
    body.theater .err {
      position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%);
      z-index: 6; max-width: min(520px, 92vw); margin: 0;
    }

    /* Settings menu section collapse */
    .menu-section-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin-bottom: 10px; cursor: default;
    }
    .menu-section-head h3 { margin: 0; }
    #ccBody {
      overflow: hidden;
      transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease;
      max-height: 600px;
      opacity: 1;
    }
    #ccBody.is-collapsed { max-height: 0; opacity: 0; pointer-events: none; }
    .shortcuts-row {
      flex-direction: column; align-items: flex-start; gap: 6px;
      padding-top: 6px; border-top: 1px solid var(--line); margin-top: 4px;
    }
    .shortcuts-label {
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600;
    }
    .shortcuts-grid {
      display: grid; grid-template-columns: auto 1fr; gap: 4px 10px;
      font-size: 0.78rem; color: var(--muted); width: 100%;
    }
    .shortcuts-grid kbd {
      font-family: monospace; background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--line); border-radius: var(--radius-sm, 6px);
      padding: 1px 5px; font-size: 0.75rem; text-align: center;
    }

    /* Sheet & Gesture shared styles */
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 998;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s var(--ease);
    }
    .sheet-backdrop.is-active {
      opacity: 1;
      pointer-events: auto;
    }
    .sheet-handle {
      display: none;
    }
    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line);
    }
    .sheet-head h3 {
      margin: 0;
      font-size: 0.76rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }
    .sheet-close {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;
      padding: 0;
    }
    .sheet-close:hover {
      color: var(--ink);
      background: rgba(255, 255, 255, 0.08);
    }
    .menu-body {
      display: flex;
      flex-direction: column;
    }
    .gesture-indicator {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 38%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 6;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .gesture-left {
      left: 0;
      border-radius: 0 100px 100px 0;
      background: radial-gradient(circle at 25% 50%, rgba(61, 214, 198, 0.28), transparent 75%);
    }
    .gesture-right {
      right: 0;
      border-radius: 100px 0 0 100px;
      background: radial-gradient(circle at 75% 50%, rgba(61, 214, 198, 0.28), transparent 75%);
    }
    .gesture-icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: var(--accent);
      font-family: Syne, sans-serif;
      font-weight: 800;
      font-size: 0.95rem;
      letter-spacing: 0.04em;
      transform: scale(0.85);
      transition: transform 0.25s var(--ease);
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    }
    .gesture-indicator.is-active {
      opacity: 1;
    }
    .gesture-indicator.is-active .gesture-icon {
      transform: scale(1.15);
    }
    .mobile-nav-pill {
      display: none;
    }

    /* Mobile Cinema Player Overhaul (<= 720px) */
    @media (max-width: 720px) {
      .page {
        display: flex;
        flex-direction: column;
        padding: 0 0 24px 0;
        padding-bottom: max(24px, env(safe-area-inset-bottom));
        gap: 12px;
        min-height: 100dvh;
      }
      .stage-wrap {
        order: 1;
        position: sticky;
        top: 0;
        z-index: 80;
        width: 100vw;
        background: #000;
      }
      .stage {
        width: 100vw;
        max-width: 100vw;
        border-radius: 0;
        border: none;
        box-shadow: none;
        aspect-ratio: 16 / 9;
      }
      header {
        order: 2;
        padding: 0 clamp(12px, 3.5vw, 18px);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        margin: 0;
      }
      .brand-wrap {
        width: 100%;
      }
      .brand {
        font-size: 1.25rem;
      }
      .ep-line {
        max-width: 100%;
        font-size: 0.8rem;
        white-space: normal;
        line-height: 1.35;
        color: var(--ink);
        opacity: 0.88;
      }
      .header-right {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .header-right .pill-toggle {
        flex-shrink: 0;
      }
      .header-right .pill {
        min-height: 40px;
        font-size: 0.82rem;
        padding: 8px 12px;
      }
      .mobile-nav-pill {
        display: inline-flex;
        background: var(--accent-dim);
        color: var(--accent);
        border: 1px solid rgba(61, 214, 198, 0.35);
      }
      .err {
        order: 3;
        margin: 0 clamp(12px, 3.5vw, 18px);
        width: calc(100% - clamp(24px, 7vw, 36px));
      }
      footer {
        order: 4;
        padding: 8px clamp(12px, 3.5vw, 18px) 0;
        font-size: 0.75rem;
        flex-direction: column;
        gap: 6px;
        align-items: flex-start;
      }

      /* Compacted Controls HUD: 64px Height, Single Row */
      .controls {
        padding: 24px 12px 8px;
        background: linear-gradient(transparent 0%, rgba(0, 0, 0, 0.88) 60%);
      }
      .seek {
        height: 8px;
        margin-bottom: 8px;
      }
      .seek::-webkit-slider-thumb {
        width: 18px;
        height: 18px;
        margin-top: -5px;
      }
      .row {
        flex-wrap: nowrap !important;
        gap: 6px;
        align-items: center;
        justify-content: space-between;
      }
      #theaterBtn,
      #speedBtn,
      #prevEpBar,
      #nextEpBar,
      .vol,
      .hint,
      .row .spacer {
        display: none !important;
      }
      .ctrl {
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        flex-shrink: 0;
      }
      .time {
        min-width: auto;
        font-size: 0.78rem;
        padding: 0 4px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .big-btn {
        width: 64px;
        height: 64px;
      }
      .big-btn svg {
        width: 28px;
        height: 28px;
      }
      .skip-btn {
        right: 12px;
        bottom: 104px;
        font-size: 13px;
        padding: 8px 14px;
      }

      /* Subtitles bounds on mobile */
      .cc-box {
        font-size: var(--cc-size, clamp(15px, 4.2vw, 22px)) !important;
        max-width: min(92%, 520px) !important;
        line-height: 1.3 !important;
        -webkit-text-stroke: 1.5px #000 !important;
      }

      /* Native Bottom Sheets for Settings & Episodes */
      .menu, .ep-panel {
        position: fixed !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        top: auto !important;
        width: 100vw !important;
        max-width: 100vw !important;
        max-height: 85dvh !important;
        border-radius: 20px 20px 0 0 !important;
        border: none !important;
        border-top: 1px solid rgba(255, 255, 255, 0.16) !important;
        background: rgba(14, 18, 26, 0.98) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.8) !important;
        z-index: 1000 !important;
        padding: 0 !important;
        transform: translateY(100%);
        transition: transform 0.28s var(--ease), opacity 0.2s ease !important;
        display: flex !important;
        flex-direction: column !important;
        visibility: hidden;
      }
      .menu.is-open, .ep-panel.is-open {
        visibility: visible !important;
        transform: translateY(0) !important;
      }
      .sheet-handle {
        display: block !important;
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.35);
        margin: 10px auto 4px;
        flex-shrink: 0;
      }
      .sheet-head {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px 12px !important;
        border-bottom: 1px solid var(--line) !important;
        margin-bottom: 0 !important;
        flex-shrink: 0;
      }
      .sheet-head h3 {
        margin: 0;
        font-size: 0.85rem !important;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink);
        font-weight: 700 !important;
      }
      .sheet-close {
        appearance: none;
        border: 0;
        background: rgba(255, 255, 255, 0.08);
        color: var(--ink);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .sheet-close:hover {
        background: rgba(255, 255, 255, 0.16);
      }
      .menu-body {
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding: 14px 16px 28px;
        flex: 1;
      }
      .ep-panel-head {
        padding: 10px 16px 12px !important;
        flex-shrink: 0;
      }
      .ep-panel-head h3 {
        font-size: 0.85rem !important;
        font-weight: 700 !important;
        color: var(--ink) !important;
      }
      .ep-panel-head .pill {
        min-height: 36px;
        padding: 6px 14px;
      }
      .ep-list {
        flex: 1;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding: 8px 12px 28px !important;
      }
      .ep-item {
        min-height: 48px;
        padding: 10px 12px !important;
        align-items: center;
      }
      .shortcuts-row {
        display: none !important;
      }
    }
    /* Landscape phone */
    @media (max-height: 500px) and (orientation: landscape) {
      .page {
        padding: 0 !important;
        gap: 0 !important;
      }
      header, footer { display: none !important; }
      .stage-wrap {
        height: 100dvh;
        min-height: 100dvh;
      }
      .stage {
        aspect-ratio: auto;
        height: 100dvh;
        width: 100vw;
        border-radius: 0;
      }
    }
    /* Touch / Coarse pointer adaptations */
    @media (pointer: coarse) {
      .ctrl { min-width: 44px; min-height: 44px; }
      .pill { min-height: 44px; }
      .speed-chip { min-height: 42px; padding: 10px 14px; font-size: 0.85rem; }
      .cc-swatch { width: 34px; height: 34px; }
      .cc-swatch::after { inset: -6px; }
      .seek { height: 10px; }
      .seek::-webkit-slider-thumb { width: 22px; height: 22px; margin-top: -6px; }
      .seek::-moz-range-thumb { width: 22px; height: 22px; }
      .menu-slider { height: 10px; }
      .menu-slider::-webkit-slider-thumb { width: 22px; height: 22px; margin-top: -6px; }
      .menu-slider::-moz-range-thumb { width: 22px; height: 22px; }
      .shortcuts-row { display: none !important; }
    }
    /* Small phone: <380px */
    @media (max-width: 380px) {
      .provider-pill { display: none !important; }
      .header-right .pill { font-size: 0.74rem; padding: 6px 10px; min-height: 36px; }
      .ctrl { width: 42px; height: 42px; }
    }
    /* Motion sensitivity */
    @media (prefers-reduced-motion: reduce) {
      html, body, .page, header, footer, .stage, .controls, .menu, .ep-panel, .skip-btn, .ap-card, .switch::after {
        transition-duration: 0.05s !important;
        animation-duration: 0.05s !important;
      }
      .spinner {
        animation: none !important;
        border-top-color: var(--accent) !important;
        opacity: 0.85;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="brand-wrap">
        <h1 class="brand"><a href="/browse" style="color:inherit;text-decoration:none">ani<span>.</span>watch</a></h1>
        ${hasEpisodeMeta ? `<p class="ep-line" title="${subtitle}">${subtitle}</p>` : '<p class="brand-by">by <em>wab</em></p>'}
      </div>
      <div class="header-right">
        <div class="pill-toggle" id="audioToggle" ${hasEither ? '' : 'hidden'}>
          <button type="button" class="pill ${initial === 'sub' ? 'is-active' : ''}" data-track="sub" ${!hasSub ? 'disabled aria-disabled="true" title="Subtitled version unavailable"' : ''}>Sub</button>
          <button type="button" class="pill ${initial === 'dub' ? 'is-active' : ''}" data-track="dub" ${!hasDub ? 'disabled aria-disabled="true" title="Dubbed version unavailable"' : ''}>Dub</button>
        </div>
        <span class="pill provider-pill" id="providerBadge" title="Stream provider" ${initialProviderLabel ? '' : 'hidden'}>${escAttr(initialProviderLabel)}</span>
        <button type="button" class="pill" id="ccTop" title="English subtitles (C)" ${hasAnyCc ? '' : 'hidden'} aria-pressed="false">CC</button>
        <button type="button" class="pill" id="epListBtn" title="Episode list (E)" ${hasAnime ? '' : 'hidden'} aria-haspopup="dialog" aria-expanded="false" aria-controls="epPanel">Episodes</button>
        <a class="pill mobile-nav-pill" id="prevEpHeader" title="Previous episode" ${prevPlaySafe ? `href="${escAttr(prevPlaySafe)}"` : 'aria-disabled="true"'} ${prevPlaySafe ? '' : 'hidden'}>← Prev</a>
        <a class="pill mobile-nav-pill" id="nextEpHeader" title="Next episode" ${nextPlaySafe ? `href="${escAttr(nextPlaySafe)}"` : 'aria-disabled="true"'} ${nextPlaySafe ? '' : 'hidden'}>Next →</a>
        <a class="pill" href="/browse" title="Back to browse" style="opacity:0.7">← Browse</a>
      </div>
    </header>

    <div class="stage-wrap">
      <div class="stage is-loading is-paused" id="stage">
        <video id="v" playsinline preload="auto"></video>
        <div class="cc-layer" id="ccLayer" aria-live="polite">
          <div class="cc-box" id="ccBox" title="Drag to move"></div>
        </div>
        <div class="gesture-indicator gesture-left" id="gestureLeft" aria-hidden="true">
          <div class="gesture-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
            <span>-10s</span>
          </div>
        </div>
        <div class="gesture-indicator gesture-right" id="gestureRight" aria-hidden="true">
          <div class="gesture-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6-8.5-6z"/></svg>
            <span>+10s</span>
          </div>
        </div>
        <div class="sheet-backdrop" id="sheetBackdrop" hidden></div>
        <div class="overlay">
          <button type="button" class="big-btn" id="bigPlay" aria-label="Play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="spinner" aria-hidden="true"></div>
        </div>
        <button type="button" class="skip-btn" id="skipBtn" hidden aria-hidden="true">Skip Intro</button>

        <div class="ap-overlay" id="autoplayOverlay" hidden>
          <div class="ap-card">
            <p class="ap-label">Next episode in</p>
            <span class="ap-count">12</span>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button type="button" class="pill ap-now" id="apNow" style="flex:1;padding:8px">Play now</button>
              <button type="button" class="pill ap-cancel" id="apCancel" style="flex:1;padding:8px;background:rgba(255,255,255,0.06)">Cancel</button>
            </div>
          </div>
        </div>

        <div class="ep-panel" id="epPanel" role="dialog" aria-modal="true" aria-label="Episode list" hidden>
          <div class="sheet-handle" aria-hidden="true"></div>
          <div class="ep-panel-head">
            <h3>Episodes</h3>
            <button type="button" class="pill" id="epPanelClose" style="padding:6px 10px">Close</button>
          </div>
          <p class="ep-panel-status" id="epPanelStatus">Loading…</p>
          <div class="ep-list" id="epList" hidden></div>
        </div>

        <div class="menu" id="settingsMenu" role="dialog" aria-modal="true" aria-label="Player settings">
          <div class="sheet-handle" aria-hidden="true"></div>
          <div class="sheet-head">
            <h3>Settings</h3>
            <button type="button" class="sheet-close" id="settingsClose" aria-label="Close settings">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
          <div class="menu-body">
          <div class="menu-section">
            <h3>Audio</h3>
            <div class="pill-toggle" id="audioToggleMenu" ${hasEither ? '' : 'hidden'} style="width:100%;justify-content:stretch">
              <button type="button" class="pill ${initial === 'sub' ? 'is-active' : ''}" data-track="sub" style="flex:1" ${!hasSub ? 'disabled aria-disabled="true" title="Subtitled version unavailable"' : ''}>Sub</button>
              <button type="button" class="pill ${initial === 'dub' ? 'is-active' : ''}" data-track="dub" style="flex:1" ${!hasDub ? 'disabled aria-disabled="true" title="Dubbed version unavailable"' : ''}>Dub</button>
            </div>
            <p class="hint" id="audioHint" style="margin-top:8px;${hasBoth ? 'display:none' : ''}">${!hasSub ? 'Sub not available for this episode.' : !hasDub ? 'Dub not available for this episode.' : 'Only one audio track is available for this episode.'}</p>
          </div>
          <div class="menu-section" ${hasNav || hasAnime ? '' : 'hidden'}>
            <h3>Episodes</h3>
            <div class="pill-toggle" style="width:100%;justify-content:stretch">
              <a class="pill" style="flex:1;text-align:center" ${prevPlaySafe ? `href="${escAttr(prevPlaySafe)}"` : 'aria-disabled="true"'} ${prevPlaySafe ? '' : 'hidden'}>Previous</a>
              <a class="pill" style="flex:1;text-align:center" ${nextPlaySafe ? `href="${escAttr(nextPlaySafe)}"` : 'aria-disabled="true"'} ${nextPlaySafe ? '' : 'hidden'}>Next</a>
            </div>
            <button type="button" class="pill" id="epListBtnMenu" style="width:100%;margin-top:8px;justify-content:center" ${hasAnime ? '' : 'hidden'} aria-haspopup="dialog" aria-expanded="false" aria-controls="epPanel">All episodes</button>
            <p class="hint" style="margin-top:8px">${epIndex && epTotal ? escAttr(`Episode ${epIndex} of ${epTotal}`) : 'Jump with Prev / Next or the episode list.'}</p>
          </div>
          <div class="menu-section" id="ccSection">
            <div class="menu-section-head" id="ccSectionHead">
              <h3 style="margin:0">Subtitles</h3>
              <button type="button" class="pill" id="ccCollapseBtn" style="padding:4px 10px;font-size:0.75rem" aria-expanded="true" aria-controls="ccBody">▲ Hide</button>
            </div>
            <div id="ccBody">
              <div class="menu-row">
                <label id="ccLabel" for="ccToggle">English CC</label>
                <button type="button" class="switch" id="ccToggle" role="switch" aria-labelledby="ccLabel" aria-checked="false" aria-pressed="false" ${hasAnyCc ? '' : 'disabled'}></button>
              </div>
              <div id="ccControls" ${hasAnyCc ? '' : 'hidden'}>

                <!-- Presets -->
                <div class="menu-row cc-setting-row" style="flex-direction:column;align-items:stretch;gap:6px">
                  <span class="cc-label">Presets</span>
                  <div class="pos-row" id="ccPresetRow">
                    <button type="button" class="pill" data-cc-preset="anime">Anime Outline</button>
                    <button type="button" class="pill" data-cc-preset="box">SubRip Box</button>
                  </div>
                </div>

                <!-- Font Color -->
                <div class="menu-row cc-setting-row">
                  <span class="cc-label">Font Color</span>
                  <div class="pos-row cc-swatch-row" id="ccColorRow">
                    <button type="button" class="cc-swatch is-active" data-cc-color="white" style="background:#fff" title="White" aria-label="White text color"></button>
                    <button type="button" class="cc-swatch" data-cc-color="yellow" style="background:#ffe066" title="Yellow" aria-label="Yellow text color"></button>
                    <button type="button" class="cc-swatch" data-cc-color="cyan" style="background:#3dd6c6" title="Cyan" aria-label="Cyan text color"></button>
                    <button type="button" class="cc-swatch" data-cc-color="lime" style="background:#86efac" title="Lime" aria-label="Lime text color"></button>
                    <button type="button" class="cc-swatch" data-cc-color="orange" style="background:#fb923c" title="Orange" aria-label="Orange text color"></button>
                    <button type="button" class="cc-swatch" data-cc-color="pink" style="background:#f472b6" title="Pink" aria-label="Pink text color"></button>
                  </div>
                </div>

                <!-- Font Opacity -->
                <div class="menu-row cc-setting-row" style="flex-direction:column;align-items:stretch;gap:6px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span class="cc-label">Font Opacity</span>
                    <span class="hint" id="ccOpacityLabel">100%</span>
                  </div>
                  <input class="menu-slider" id="ccOpacity" type="range" min="30" max="100" step="5" value="100" aria-label="Caption opacity" />
                </div>

                <!-- Font Size -->
                <div class="menu-row cc-setting-row" style="flex-direction:column;align-items:stretch;gap:6px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span class="cc-label">Font Size</span>
                    <span class="hint" id="ccSizeLabel">34px</span>
                  </div>
                  <input class="menu-slider" id="ccSize" type="range" min="16" max="60" step="1" value="34" aria-label="Caption size" />
                </div>

                <!-- Font Family -->
                <div class="menu-row cc-setting-row" style="flex-direction:column;align-items:stretch;gap:6px">
                  <span class="cc-label">Font Family</span>
                  <div class="pos-row cc-font-row" id="ccFontRow">
                    <button type="button" class="cc-font-btn is-active" data-cc-font="dm" style="font-family: 'DM Sans', sans-serif;">DM Sans</button>
                    <button type="button" class="cc-font-btn" data-cc-font="trebuchet" style="font-family: 'Trebuchet MS', sans-serif;">Trebuchet</button>
                    <button type="button" class="cc-font-btn" data-cc-font="rosario" style="font-family: 'Rosario', sans-serif;">Rosario</button>
                    <button type="button" class="cc-font-btn" data-cc-font="sans" style="font-family: system-ui, sans-serif;">System</button>
                    <button type="button" class="cc-font-btn" data-cc-font="serif" style="font-family: Georgia, serif;">Serif</button>
                    <button type="button" class="cc-font-btn" data-cc-font="mono" style="font-family: 'Courier New', monospace;">Mono</button>
                  </div>
                </div>

                <!-- Character Edge (style) -->
                <div class="menu-row cc-setting-row" style="flex-direction:column;align-items:stretch;gap:6px">
                  <span class="cc-label">Character Edge</span>
                  <div class="pos-row" id="ccStyleRow">
                    <button type="button" class="pill is-active" data-cc-style="outline">Outline</button>
                    <button type="button" class="pill" data-cc-style="raised">Raised</button>
                    <button type="button" class="pill" data-cc-style="drop">Drop</button>
                    <button type="button" class="pill" data-cc-style="box">Box</button>
                    <button type="button" class="pill" data-cc-style="none">None</button>
                  </div>
                </div>

                <!-- Edge / Stroke Color -->
                <div class="menu-row cc-setting-row">
                  <span class="cc-label">Edge Color</span>
                  <div class="pos-row cc-swatch-row" id="ccEdgeRow">
                    <button type="button" class="cc-swatch is-active" data-cc-edge="black" style="background:#000;border:2px solid rgba(255,255,255,0.25)" title="Black" aria-label="Black edge"></button>
                    <button type="button" class="cc-swatch" data-cc-edge="darkgray" style="background:#374151" title="Dark Gray" aria-label="Dark Gray edge"></button>
                    <button type="button" class="cc-swatch" data-cc-edge="white" style="background:#fff;border:2px solid rgba(255,255,255,0.25)" title="White" aria-label="White edge"></button>
                    <button type="button" class="cc-swatch" data-cc-edge="red" style="background:#dc2626" title="Red" aria-label="Red edge"></button>
                    <button type="button" class="cc-swatch" data-cc-edge="blue" style="background:#3b82f6" title="Blue" aria-label="Blue edge"></button>
                  </div>
                </div>

                <!-- Background Color -->
                <div class="menu-row cc-setting-row">
                  <span class="cc-label">Background</span>
                  <div class="pos-row" id="ccBgRow">
                    <button type="button" class="pill is-active" data-cc-bg="none">None</button>
                    <button type="button" class="pill" data-cc-bg="dark">Dark</button>
                    <button type="button" class="pill" data-cc-bg="semi">Semi</button>
                    <button type="button" class="pill" data-cc-bg="solid">Solid</button>
                  </div>
                </div>

                <!-- Position -->
                <div class="menu-row cc-setting-row" style="flex-direction:column;align-items:stretch;gap:6px">
                  <span class="cc-label">Position</span>
                  <div class="pos-row" id="ccPosRow">
                    <button type="button" class="pill" data-cc-pos="top">Top</button>
                    <button type="button" class="pill" data-cc-pos="middle">Mid</button>
                    <button type="button" class="pill is-active" data-cc-pos="bottom">Bottom</button>
                  </div>
                  <p class="hint" style="margin:0;font-size:0.72rem">Drag captions on the video to reposition.</p>
                </div>

              </div>
              <p class="hint" id="ccHint" style="margin-top:8px;${hasAnyCc ? 'display:none' : ''}">No English softsubs for this episode.</p>
            </div>
          </div>
          <div class="menu-section">
            <h3>Speed</h3>
            <div class="speed-row" id="speedRow"></div>
          </div>
          <div class="menu-section">
            <h3>Quality</h3>
            <select id="quality" aria-label="Quality">
              <option value="-1">Auto</option>
            </select>
          </div>
          <div class="menu-section">
            <div class="menu-row">
              <label id="loopLabel" for="loopToggle">Loop</label>
              <button type="button" class="switch" id="loopToggle" role="switch" aria-labelledby="loopLabel" aria-checked="false" aria-pressed="false"></button>
            </div>
            <div class="menu-row">
              <label id="theaterLabel" for="theaterToggle">Theater mode</label>
              <button type="button" class="switch" id="theaterToggle" role="switch" aria-labelledby="theaterLabel" aria-checked="false" aria-pressed="false"></button>
            </div>
            <div class="menu-row">
              <label>Picture in picture</label>
              <button type="button" class="pill" id="pipBtn" style="padding:6px 10px">Pop out</button>
            </div>
            <div class="menu-row" id="castRow" hidden>
              <label>Cast to TV</label>
              <button type="button" class="pill" id="castBtn" style="padding:6px 10px" title="Cast to a nearby screen or smart TV">📺 Cast</button>
            </div>
            <div class="menu-row shortcuts-row">
              <label class="shortcuts-label">Keyboard shortcuts</label>
              <div class="shortcuts-grid">
                <kbd>Space</kbd><span>Play / Pause</span>
                <kbd>← →</kbd><span>Seek ±10s</span>
                <kbd>↑ ↓</kbd><span>Volume ±5%</span>
                <kbd>[ ]</kbd><span>Prev / Next episode</span>
                <kbd>F</kbd><span>Fullscreen</span>
                <kbd>T</kbd><span>Theater mode</span>
                <kbd>C</kbd><span>Captions on/off</span>
                <kbd>M</kbd><span>Mute</span>
                <kbd>, .</kbd><span>Speed down / up</span>
              </div>
            </div>
          </div>
          </div>
        </div>

        <div class="controls" id="controls">
          <input class="seek" id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" />
          <div class="row">
            <button type="button" class="ctrl" id="play" aria-label="Play">
              <svg id="playIcon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button type="button" class="ctrl" id="mute" aria-label="Mute">
              <svg id="muteIcon" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>
            </button>
            <input class="vol" id="vol" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
            <span class="time" id="time">0:00 / 0:00</span>
            <button type="button" class="speed-chip" id="speedBtn" title="Playback speed">1x</button>
            <a class="pill nav-pill" id="prevEpBar" title="Previous episode ([)" ${prevPlaySafe ? `href="${escAttr(prevPlaySafe)}"` : 'aria-disabled="true" tabindex="-1"'} ${prevPlaySafe ? '' : 'hidden'} style="padding:6px 10px;min-width:auto">← Prev</a>
            <a class="pill nav-pill" id="nextEpBar" title="Next episode (])" ${nextPlaySafe ? `href="${escAttr(nextPlaySafe)}"` : 'aria-disabled="true" tabindex="-1"'} ${nextPlaySafe ? '' : 'hidden'} style="padding:6px 10px;min-width:auto">Next →</a>
            <button type="button" class="ctrl" id="ccBtn" aria-label="English captions" title="English CC (C)" ${hasAnyCc ? '' : 'hidden'}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8.5 10.5c-.8 0-1.4-.3-1.9-.8l.9-.9c.3.3.6.5 1 .5.5 0 .8-.3.8-.7 0-.5-.4-.7-1.1-.7H9.5v-1.2h.7c.5 0 .9-.2.9-.6 0-.3-.2-.6-.7-.6-.3 0-.6.1-.8.4l-.9-.8c.4-.5 1-.8 1.8-.8 1.2 0 1.9.6 1.9 1.4 0 .5-.3.9-.8 1.1.6.2 1 0.7 1 1.3 0 1-.9 1.4-2.1 1.4zm7 0c-.8 0-1.4-.3-1.9-.8l.9-.9c.3.3.6.5 1 .5.5 0 .8-.3.8-.7 0-.5-.4-.7-1.1-.7h-.7v-1.2h.7c.5 0 .9-.2.9-.6 0-.3-.2-.6-.7-.6-.3 0-.6.1-.8.4l-.9-.8c.4-.5 1-.8 1.8-.8 1.2 0 1.9.6 1.9 1.4 0 .5-.3.9-.8 1.1.6.2 1 .7 1 1.3 0 1-.9 1.4-2.1 1.4z"/></svg>
            </button>
            <span class="spacer"></span>
            <button type="button" class="ctrl" id="settingsBtn" aria-label="Settings" title="Settings" aria-haspopup="dialog" aria-expanded="false" aria-controls="settingsMenu">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.89 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.24l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.1.54 0 .68-.24l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>
            </button>
            <button type="button" class="ctrl" id="theaterBtn" aria-label="Theater mode" title="Theater mode">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v10H4V6zm0 12h16v2H4v-2z"/></svg>
            </button>
            <button type="button" class="ctrl" id="fs" aria-label="Fullscreen">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5h2zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <p class="err" id="err" hidden></p>
    <footer>
      <span>${SITE_NAME} · <a href="/browse">Browse</a></span>
      <span style="color:var(--muted);font-size:0.75rem">${NOTICE_SHORT}</span>
    </footer>
  </div>

  <script>
    (function () {
      var streams = ${safeJson(streams)};
      var captions = ${safeJson(captions)};
      var skips = ${safeJson(skips)};
      var providers = ${safeJson(providers)};
      var animeId = ${safeJson(animeId)};
      var animeName = ${safeJson(animeTitle || '')};
      var playCategory = ${safeJson(category)};
      var currentEpNum = ${safeJson(epNum)};
      var currentEpTitle = ${safeJson(epTitle || '')};
      var PROVIDER_LABELS = { megaplay: 'MegaPlay', zoko: 'Zoko' };
      var track = ${safeJson(initial)};
      var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
      var video = document.getElementById('v');
      var stage = document.getElementById('stage');
      var err = document.getElementById('err');
      var seek = document.getElementById('seek');
      var vol = document.getElementById('vol');
      var timeEl = document.getElementById('time');
      var playBtn = document.getElementById('play');
      var bigPlay = document.getElementById('bigPlay');
      var muteBtn = document.getElementById('mute');
      var fsBtn = document.getElementById('fs');
      var playIcon = document.getElementById('playIcon');
      var muteIcon = document.getElementById('muteIcon');
      var settingsBtn = document.getElementById('settingsBtn');
      var settingsMenu = document.getElementById('settingsMenu');
      var speedBtn = document.getElementById('speedBtn');
      var speedRow = document.getElementById('speedRow');
      var quality = document.getElementById('quality');
      var loopToggle = document.getElementById('loopToggle');
      var theaterToggle = document.getElementById('theaterToggle');
      var theaterBtn = document.getElementById('theaterBtn');
      var ccToggle = document.getElementById('ccToggle');
      var ccBtn = document.getElementById('ccBtn');
      var ccTop = document.getElementById('ccTop');
      var ccLayer = document.getElementById('ccLayer');
      var ccBox = document.getElementById('ccBox');
      var ccSize = document.getElementById('ccSize');
      var ccSizeLabel = document.getElementById('ccSizeLabel');
      var ccOpacityEl = document.getElementById('ccOpacity');
      var ccOpacityLabel = document.getElementById('ccOpacityLabel');
      var pipBtn = document.getElementById('pipBtn');
      var skipBtn = document.getElementById('skipBtn');
      var providerBadge = document.getElementById('providerBadge');
      var epListBtn = document.getElementById('epListBtn');
      var epListBtnMenu = document.getElementById('epListBtnMenu');
      var epPanel = document.getElementById('epPanel');
      var epPanelClose = document.getElementById('epPanelClose');
      var epPanelStatus = document.getElementById('epPanelStatus');
      var epList = document.getElementById('epList');
      var sheetBackdrop = document.getElementById('sheetBackdrop');
      var settingsClose = document.getElementById('settingsClose');
      var gestureLeft = document.getElementById('gestureLeft');
      var gestureRight = document.getElementById('gestureRight');
      var hideTimer = null;
      var hls = null;
      var switching = false;
      var skipMode = null;
      var rate = Number(localStorage.getItem('ani.rate') || '1') || 1;
      var theater = localStorage.getItem('ani.theater') === '1';
      var ccOn = localStorage.getItem('ani.cc') === '1';
      var ccSizePx = Math.min(60, Math.max(16, Number(localStorage.getItem('ani.ccSize') || '34') || 34));
      var ccX = Number(localStorage.getItem('ani.ccX') || 'NaN');
      var ccY = Number(localStorage.getItem('ani.ccY') || 'NaN');
      var CC_STYLES = ['box', 'outline', 'raised', 'drop', 'none'];
      var CC_COLORS = { white: '#fff', yellow: '#ffe066', cyan: '#3dd6c6', lime: '#86efac', orange: '#fb923c', pink: '#f472b6' };
      var CC_FONTS = { dm: '"DM Sans",sans-serif', trebuchet: '"Trebuchet MS","Trebuchet",sans-serif', rosario: '"Rosario",sans-serif', sans: 'system-ui,sans-serif', serif: 'Georgia,serif', mono: '"Courier New",monospace' };
      var CC_EDGES = { black: '#000', darkgray: '#374151', white: '#fff', red: '#dc2626', blue: '#3b82f6' };
      var CC_BGS = { none: 'transparent', dark: 'rgba(0,0,0,0.82)', semi: 'rgba(0,0,0,0.55)', solid: '#000' };
      var ccStyle = CC_STYLES.indexOf(localStorage.getItem('ani.ccStyle') || '') >= 0 ? localStorage.getItem('ani.ccStyle') : 'outline';
      var ccColorKey = CC_COLORS[localStorage.getItem('ani.ccColor')] ? localStorage.getItem('ani.ccColor') : 'white';
      var ccFontKey = CC_FONTS[localStorage.getItem('ani.ccFont')] ? localStorage.getItem('ani.ccFont') : 'dm';
      var ccEdgeKey = CC_EDGES[localStorage.getItem('ani.ccEdge')] ? localStorage.getItem('ani.ccEdge') : 'black';
      var ccBgKey = CC_BGS[localStorage.getItem('ani.ccBg')] ? localStorage.getItem('ani.ccBg') : 'none';
      var ccOpacity = Math.min(100, Math.max(30, Number(localStorage.getItem('ani.ccOpacity') || '100') || 100));
      var ccCollapsed = localStorage.getItem('ani.ccCollapsed') !== '0'; // collapsed by default unless user explicitly opened it
      if (!isFinite(ccX)) ccX = 50;
      if (!isFinite(ccY)) ccY = 10;
      var ccCues = [];
      var ccMaxDuration = 0;
      var ccSrcLoaded = '';
      var ccFetchToken = 0;
      var activeCueText = '';
      var draggingCc = false;
      var ccDragOffsetX = 0; // pointer offset within box at drag start (% of stage width)
      var ccDragOffsetY = 0;

      // ── Continue-watching & history ───────────────────────────────────────
      var CW_KEY = 'ani.cw';
      var HIST_KEY = 'ani.hist';
      var CW_MAX = 30;
      var cwSaveTimer = null;
      function cwRead() {
        try { return JSON.parse(localStorage.getItem(CW_KEY) || '[]'); } catch (e) { return []; }
      }
      function cwSave(t) {
        if (!animeId || !currentEpNum) return;
        var d = video.duration;
        if (!isFinite(d) || d < 30) return; // skip very short / unloaded
        var pct = d > 0 ? t / d : 0;
        // Mark watched if >85% through
        if (pct > 0.85 && animeId && currentEpNum) {
          try {
            var watched = JSON.parse(localStorage.getItem('ani.watched.' + animeId) || '[]');
            if (watched.indexOf(String(currentEpNum)) < 0) {
              watched.push(String(currentEpNum));
              localStorage.setItem('ani.watched.' + animeId, JSON.stringify(watched));
              // refresh progress dots in episode panel
              document.querySelectorAll('.ep-item[data-epn]').forEach(function (el) {
                if (el.getAttribute('data-epn') === String(currentEpNum)) {
                  el.classList.add('is-watched');
                }
              });
            }
          } catch (e) {}
        }
        var entry = {
          id: animeId,
          name: animeName || animeId,
          epNum: currentEpNum,
          epTitle: currentEpTitle || null,
          t: Math.floor(t),
          dur: Math.floor(d),
          ts: Date.now(),
          href: location.href,
          poster: (function () {
            try {
              var meta = JSON.parse(localStorage.getItem('ani.meta.' + animeId) || 'null');
              return (meta && meta.poster) || null;
            } catch (e) { return null; }
          })(),
        };
        try {
          var list = cwRead().filter(function (x) { return x.id !== animeId; });
          list.unshift(entry);
          if (list.length > CW_MAX) list = list.slice(0, CW_MAX);
          localStorage.setItem(CW_KEY, JSON.stringify(list));
        } catch (e) {}
      }
      function cwThrottle(t) {
        if (cwSaveTimer) return;
        cwSaveTimer = setTimeout(function () {
          cwSaveTimer = null;
          cwSave(t);
        }, 5000);
      }
      // Remove from continue-watching when finished
      function cwRemove() {
        try {
          var list = cwRead().filter(function (x) { return x.id !== animeId; });
          localStorage.setItem(CW_KEY, JSON.stringify(list));
        } catch (e) {}
      }
      window.addEventListener('pagehide', function () { cwSave(video.currentTime || 0); });

      // ── Quality selector state ─────────────────────────────────────────────
      var qualityManual = -1; // -1 = auto

      // ── Auto-play countdown ────────────────────────────────────────────────
      var autoplayTimer = null;
      var autoplayCancelled = false;

      var ICONS = {
        play: '<path d="M8 5v14l11-7z"/>',
        pause: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
        vol: '<path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>',
        muted: '<path d="M5 9v6h4l5 5V4L9 9H5zm12.5 1.5 1.8-1.8 1.4 1.4-1.8 1.8 1.8 1.8-1.4 1.4-1.8-1.8-1.8 1.8-1.4-1.4 1.8-1.8-1.8-1.8 1.4-1.4 1.8 1.8z"/>'
      };

      function fail(msg, fallbackTrack) {
        err.hidden = false;
        err.innerHTML = '';
        var span = document.createElement('span');
        span.textContent = msg;
        err.appendChild(span);
        if (fallbackTrack && streams[fallbackTrack]) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pill is-active';
          btn.style.marginLeft = '12px';
          btn.style.padding = '4px 10px';
          btn.style.fontSize = '12px';
          btn.textContent = 'Switch to ' + fallbackTrack.toUpperCase();
          btn.onclick = function () {
            clearErr();
            loadTrack(fallbackTrack, true);
          };
          err.appendChild(btn);
        } else {
          var retryBtn = document.createElement('button');
          retryBtn.type = 'button';
          retryBtn.className = 'pill';
          retryBtn.style.marginLeft = '12px';
          retryBtn.style.padding = '4px 10px';
          retryBtn.style.fontSize = '12px';
          retryBtn.textContent = 'Retry stream';
          retryBtn.onclick = function () {
            clearErr();
            loadTrack(track, true);
          };
          err.appendChild(retryBtn);
        }
        stage.classList.remove('is-loading');
        switching = false;
      }
      function clearErr() { err.hidden = true; err.textContent = ''; }

      function fmt(sec) {
        if (!isFinite(sec) || sec < 0) return '0:00';
        var s = Math.floor(sec % 60);
        var m = Math.floor((sec / 60) % 60);
        var h = Math.floor(sec / 3600);
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
      }

      function setPlaying(playing) {
        stage.classList.toggle('is-paused', !playing);
        playIcon.innerHTML = playing ? ICONS.pause : ICONS.play;
        playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        bigPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        bigPlay.querySelector('svg').innerHTML = playing ? ICONS.pause : ICONS.play;
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
          } catch (e) {}
        }
      }

      function setMuted(muted) {
        muteIcon.innerHTML = muted || video.volume === 0 ? ICONS.muted : ICONS.vol;
        muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      }

      function applyVolume(val) {
        var v = Math.max(0, Math.min(1, Number(val)));
        if (!isFinite(v)) v = 1;
        video.volume = v;
        video.muted = v === 0;
        vol.value = String(v);
        vol.style.setProperty('--vol', (v * 100) + '%');
        setMuted(video.muted);
        try { localStorage.setItem('ani.vol', String(v)); } catch (e) {}
      }

      function updateProgress() {
        var d = video.duration || 0;
        var t = video.currentTime || 0;
        if (!seek.matches(':active')) seek.value = String(d ? (t / d) * 1000 : 0);
        seek.style.setProperty('--progress', (d ? (t / d) * 100 : 0) + '%');
        timeEl.textContent = fmt(t) + ' / ' + fmt(d);
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && isFinite(d) && d > 0 && isFinite(t)) {
          try {
            navigator.mediaSession.setPositionState({
              duration: d,
              playbackRate: video.playbackRate || 1,
              position: Math.min(Math.max(t, 0), d),
            });
          } catch (e) {}
        }
      }

      function currentSkip() {
        var pack = skips[track] || skips.sub || skips.dub || {};
        return pack;
      }

      function inRange(t, range) {
        return range && isFinite(range.start) && isFinite(range.end) && t >= range.start && t < range.end;
      }

      function updateSkip() {
        if (!skipBtn) return;
        var pack = currentSkip();
        var t = video.currentTime || 0;
        var mode = null;
        if (inRange(t, pack.intro)) mode = 'intro';
        else if (inRange(t, pack.outro)) mode = 'outro';
        skipMode = mode;
        if (!mode) {
          skipBtn.hidden = true;
          skipBtn.classList.remove('is-visible');
          skipBtn.setAttribute('aria-hidden', 'true');
          return;
        }
        skipBtn.hidden = false;
        skipBtn.classList.add('is-visible');
        skipBtn.setAttribute('aria-hidden', 'false');
        skipBtn.textContent = mode === 'intro' ? 'Skip Intro' : 'Skip Outro';
      }

      function doSkip() {
        var pack = currentSkip();
        var range = skipMode === 'outro' ? pack.outro : pack.intro;
        if (!range || !isFinite(range.end)) return;
        var target = range.end;
        var d = video.duration;
        if (isFinite(d) && d > 0) target = Math.min(target, Math.max(0, d - 0.25));
        video.currentTime = Math.max(0, target);
        updateProgress();
        updateSkip();
        pokeControls();
      }

      function pokeControls() {
        stage.classList.add('show-controls');
        stage.classList.remove('cursor-hidden');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          if (!video.paused && !settingsMenu.classList.contains('is-open')) {
            stage.classList.remove('show-controls');
            stage.classList.add('cursor-hidden');
          }
        }, 3500);
      }

      function togglePlay() {
        if (video.paused) {
          video.play().catch(function () {
            setPlaying(false);
          });
        } else {
          video.pause();
        }
      }
      function toggleMute() {
        video.muted = !video.muted;
        setMuted(video.muted);
      }
      function toggleFs() {
        if (!document.fullscreenElement) {
          if (settingsMenu.classList.contains('is-open')) toggleSettings(false);
          (stage.requestFullscreen && stage.requestFullscreen()) || (stage.webkitRequestFullscreen && stage.webkitRequestFullscreen());
        } else {
          document.exitFullscreen && document.exitFullscreen();
        }
      }

      function setTheater(on) {
        theater = !!on;
        document.body.classList.toggle('theater', theater);
        theaterToggle.classList.toggle('is-on', theater);
        theaterToggle.setAttribute('aria-pressed', theater ? 'true' : 'false');
        theaterToggle.setAttribute('aria-checked', theater ? 'true' : 'false');
        theaterBtn.classList.toggle('is-on', theater);
        theaterBtn.setAttribute('aria-pressed', theater ? 'true' : 'false');
        try { localStorage.setItem('ani.theater', theater ? '1' : '0'); } catch (e) {}
        pokeControls();
      }

      function syncCcButtons() {
        var available = Boolean(captions[track]);
        [ccBtn, ccTop].forEach(function (el) {
          if (!el) return;
          el.hidden = !captions.sub && !captions.dub;
          el.disabled = !available;
          el.classList.toggle('is-active', ccOn && available);
          el.setAttribute('aria-pressed', ccOn && available ? 'true' : 'false');
        });
        if (ccToggle) {
          ccToggle.disabled = !available;
          ccToggle.classList.toggle('is-on', ccOn && available);
          ccToggle.setAttribute('aria-pressed', ccOn && available ? 'true' : 'false');
          ccToggle.setAttribute('aria-checked', ccOn && available ? 'true' : 'false');
        }
        if (ccLayer) ccLayer.classList.toggle('is-on', ccOn && available);
      }

      function parseTs(raw) {
        var s = String(raw || '').trim().replace(',', '.');
        var parts = s.split(':');
        var h = 0, m = 0, sec = 0;
        if (parts.length === 3) {
          h = Number(parts[0]) || 0;
          m = Number(parts[1]) || 0;
          sec = parseFloat(parts[2]) || 0;
        } else if (parts.length === 2) {
          m = Number(parts[0]) || 0;
          sec = parseFloat(parts[1]) || 0;
        } else {
          sec = parseFloat(s) || 0;
        }
        return h * 3600 + m * 60 + sec;
      }

      function parseVtt(text) {
        var cues = [];
        var maxDur = 0;
        var blocks = String(text || '').replace(/\\r/g, '').split(/\\n\\n+/);
        for (var i = 0; i < blocks.length; i++) {
          var block = blocks[i].trim();
          if (!block || /^WEBVTT/i.test(block) || /^NOTE\\b/i.test(block) || /^STYLE\\b/i.test(block)) continue;
          var lines = block.split('\\n');
          var timeIdx = -1;
          for (var j = 0; j < lines.length; j++) {
            if (lines[j].indexOf('-->') >= 0) { timeIdx = j; break; }
          }
          if (timeIdx < 0) continue;
          var m = lines[timeIdx].match(/([\\d:.]+)\\s*-->\\s*([\\d:.]+)/);
          if (!m) continue;
          var body = lines.slice(timeIdx + 1).join('\\n')
            .replace(/<\\/?[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          if (!body) continue;
          var start = parseTs(m[1]);
          var end = parseTs(m[2]);
          var dur = end - start;
          if (dur > maxDur) maxDur = dur;
          cues.push({ start: start, end: end, text: body });
        }
        cues.sort(function (a, b) { return a.start - b.start; });
        return { cues: cues, maxDuration: maxDur };
      }

      function applyCcStyle() {
        if (!ccBox) return;
        ccBox.style.setProperty('--cc-size', ccSizePx + 'px');
        ccBox.style.setProperty('--cc-x', ccX + '%');
        ccBox.style.setProperty('--cc-y', ccY + '%');
        ccBox.style.setProperty('--cc-opacity', String(ccOpacity / 100));
        // Font
        var fontStack = CC_FONTS[ccFontKey] || '"DM Sans",sans-serif';
        ccBox.style.setProperty('--cc-font-family', fontStack);
        ccBox.style.fontFamily = fontStack;
        // Style preset
        ccBox.setAttribute('data-style', ccStyle);
        // Text color
        var color = CC_COLORS[ccColorKey] || '#fff';
        ccBox.style.setProperty('--cc-color', color);
        // Edge / stroke color
        var edgeColor = CC_EDGES[ccEdgeKey] || '#000';
        var strokePx = (ccStyle === 'none' || ccStyle === 'box') ? '0px transparent' : '2.5px ' + edgeColor;
        ccBox.style.setProperty('--cc-stroke', strokePx);
        // Background
        var bgVal = CC_BGS[ccBgKey] || 'transparent';
        // If style is 'box' and bg is 'none', force dark box background
        var effectiveBg = ccStyle === 'box' ? (bgVal === 'transparent' ? 'rgba(0,0,0,0.82)' : bgVal) : bgVal;
        ccBox.style.setProperty('--cc-bg', effectiveBg);
        // Weight: Trebuchet and Rosario look best at 700
        ccBox.style.setProperty('--cc-weight', '700');
        // Opacity handled via --cc-opacity CSS var now (applied on .is-visible)
        ccBox.style.opacity = '';
        // Sync size slider
        if (ccSize) ccSize.value = String(ccSizePx);
        if (ccSizeLabel) ccSizeLabel.textContent = ccSizePx + 'px';
        // Sync opacity slider
        if (ccOpacityEl) ccOpacityEl.value = String(ccOpacity);
        if (ccOpacityLabel) ccOpacityLabel.textContent = ccOpacity + '%';
        // Sync pos buttons
        document.querySelectorAll('[data-cc-pos]').forEach(function (btn) {
          var pos = btn.getAttribute('data-cc-pos');
          var active =
            (pos === 'top' && ccY >= 78) ||
            (pos === 'middle' && ccY >= 40 && ccY < 78) ||
            (pos === 'bottom' && ccY < 40);
          btn.classList.toggle('is-active', active);
        });
        // Sync style buttons
        document.querySelectorAll('[data-cc-style]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cc-style') === ccStyle);
        });
        // Sync color swatches
        document.querySelectorAll('[data-cc-color]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cc-color') === ccColorKey);
        });
        // Sync edge swatches
        document.querySelectorAll('[data-cc-edge]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cc-edge') === ccEdgeKey);
        });
        // Sync background buttons
        document.querySelectorAll('[data-cc-bg]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cc-bg') === ccBgKey);
        });
        // Sync font buttons
        document.querySelectorAll('[data-cc-font]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cc-font') === ccFontKey);
        });
        // Sync presets
        var isAnime = ccStyle === 'outline' && (ccFontKey === 'rosario' || ccFontKey === 'trebuchet') && ccBgKey === 'none';
        var isBox = ccStyle === 'box' && ccBgKey === 'dark';
        document.querySelectorAll('[data-cc-preset]').forEach(function (btn) {
          var p = btn.getAttribute('data-cc-preset');
          btn.classList.toggle('is-active', (p === 'anime' && isAnime) || (p === 'box' && isBox));
        });
      }

      function persistCcLayout() {
        try {
          localStorage.setItem('ani.ccSize', String(ccSizePx));
          localStorage.setItem('ani.ccX', String(Math.round(ccX * 10) / 10));
          localStorage.setItem('ani.ccY', String(Math.round(ccY * 10) / 10));
          localStorage.setItem('ani.ccStyle', ccStyle);
          localStorage.setItem('ani.ccColor', ccColorKey);
          localStorage.setItem('ani.ccFont', ccFontKey);
          localStorage.setItem('ani.ccEdge', ccEdgeKey);
          localStorage.setItem('ani.ccBg', ccBgKey);
          localStorage.setItem('ani.ccOpacity', String(ccOpacity));
        } catch (e) {}
      }

      function setCcPos(preset) {
        if (preset === 'top') { ccX = 50; ccY = 86; }
        else if (preset === 'middle') { ccX = 50; ccY = 48; }
        else { ccX = 50; ccY = 12; }
        applyCcStyle();
        persistCcLayout();
      }

      function hideCcText() {
        activeCueText = '';
        if (ccBox) {
          ccBox.textContent = '';
          ccBox.classList.remove('is-visible');
        }
      }

      function unloadCaptions() {
        ccFetchToken += 1;
        ccCues = [];
        ccMaxDuration = 0;
        ccSrcLoaded = '';
        hideCcText();
        if (ccLayer) ccLayer.classList.remove('is-on');
        // Also disable any leftover native tracks from older sessions
        try {
          Array.from(video.querySelectorAll('track')).forEach(function (el) { el.remove(); });
          Array.from(video.textTracks || []).forEach(function (tt) { tt.mode = 'disabled'; });
        } catch (e) {}
      }

      function findFirstGte(cues, val) {
        var l = 0, r = cues.length - 1, ans = cues.length;
        while (l <= r) {
          var mid = (l + r) >> 1;
          if (cues[mid].start >= val) {
            ans = mid;
            r = mid - 1;
          } else {
            l = mid + 1;
          }
        }
        return ans;
      }

      function findLastLte(cues, val) {
        var l = 0, r = cues.length - 1, ans = -1;
        while (l <= r) {
          var mid = (l + r) >> 1;
          if (cues[mid].start <= val) {
            ans = mid;
            l = mid + 1;
          } else {
            r = mid - 1;
          }
        }
        return ans;
      }

      function renderCcAt(t) {
        if (!ccOn || !ccCues.length) {
          hideCcText();
          return;
        }
        var text = '';
        var startIdx = findFirstGte(ccCues, t - ccMaxDuration);
        var endIdx = findLastLte(ccCues, t);
        if (startIdx <= endIdx && startIdx < ccCues.length && endIdx >= 0) {
          for (var i = startIdx; i <= endIdx; i++) {
            var c = ccCues[i];
            if (t >= c.start && t <= c.end) {
              text = text ? text + '\\n' + c.text : c.text;
            }
          }
        }
        if (text === activeCueText) return;
        activeCueText = text;
        if (!ccBox) return;
        if (!text) {
          ccBox.textContent = '';
          ccBox.classList.remove('is-visible');
          return;
        }
        ccBox.textContent = text;
        ccBox.classList.add('is-visible');
      }

      function applyCaptions() {
        var src = captions[track];
        syncCcButtons();
        if (!ccOn || !src) {
          unloadCaptions();
          syncCcButtons();
          return;
        }
        if (ccLayer) ccLayer.classList.add('is-on');
        applyCcStyle();
        if (ccSrcLoaded === src && ccCues.length) {
          renderCcAt(video.currentTime || 0);
          return;
        }
        var token = ++ccFetchToken;
        ccCues = [];
        ccMaxDuration = 0;
        hideCcText();
        fetch(src)
          .then(function (r) {
            if (!r.ok) throw new Error('cc ' + r.status);
            return r.text();
          })
          .then(function (text) {
            if (token !== ccFetchToken) return;
            var parsed = parseVtt(text);
            ccCues = parsed.cues;
            ccMaxDuration = parsed.maxDuration || 0;
            ccSrcLoaded = src;
            renderCcAt(video.currentTime || 0);
          })
          .catch(function () {
            if (token !== ccFetchToken) return;
            ccCues = [];
            ccMaxDuration = 0;
            ccSrcLoaded = '';
            hideCcText();
          });
      }

      function setCc(on) {
        ccOn = !!on;
        try { localStorage.setItem('ani.cc', ccOn ? '1' : '0'); } catch (e) {}
        if (!ccOn) unloadCaptions();
        applyCaptions();
      }

      function setRate(next) {
        rate = next;
        video.playbackRate = rate;
        speedBtn.textContent = (rate % 1 === 0 ? rate.toFixed(0) : String(rate)) + 'x';
        try { localStorage.setItem('ani.rate', String(rate)); } catch (e) {}
        speedRow.querySelectorAll('.speed-chip').forEach(function (btn) {
          btn.classList.toggle('is-active', Number(btn.dataset.rate) === rate);
        });
      }

      function cycleRate(dir) {
        var i = SPEEDS.indexOf(rate);
        if (i < 0) i = SPEEDS.indexOf(1);
        i = Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
        setRate(SPEEDS[i]);
      }

      function fillSpeeds() {
        speedRow.innerHTML = '';
        SPEEDS.forEach(function (s) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'speed-chip' + (s === rate ? ' is-active' : '');
          b.dataset.rate = String(s);
          b.textContent = (s % 1 === 0 ? s.toFixed(0) : String(s)) + 'x';
          b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            setRate(s);
          });
          speedRow.appendChild(b);
        });
      }

      function syncAudioButtons() {
        document.querySelectorAll('[data-track]').forEach(function (btn) {
          var t = btn.getAttribute('data-track');
          btn.classList.toggle('is-active', t === track);
          btn.disabled = !streams[t];
        });
        updateProviderBadge();
      }

      function updateProviderBadge() {
        if (!providerBadge) return;
        var id = providers[track] || providers.sub || providers.dub || null;
        var label = id ? (PROVIDER_LABELS[id] || id) : '';
        if (!label) {
          providerBadge.hidden = true;
          providerBadge.textContent = '';
        } else {
          providerBadge.hidden = false;
          providerBadge.textContent = label;
        }
      }

      function fillQuality() {
        quality.innerHTML = '<option value="-1">Auto</option>';
        if (!hls || !hls.levels || !hls.levels.length) return;
        hls.levels.forEach(function (lvl, i) {
          var opt = document.createElement('option');
          opt.value = String(i);
          var h = lvl.height || 0;
          opt.textContent = h ? h + 'p' : (lvl.bitrate ? Math.round(lvl.bitrate / 1000) + ' kbps' : 'Level ' + i);
          quality.appendChild(opt);
        });
        // Restore manual level if user already picked one this session
        if (qualityManual >= 0 && qualityManual < hls.levels.length) {
          hls.currentLevel = qualityManual;
          quality.value = String(qualityManual);
        } else {
          quality.value = String(hls.autoLevelEnabled ? -1 : hls.currentLevel);
        }
      }

      function destroyHls() {
        if (hls) {
          try { hls.stopLoad(); } catch (e) {}
          try { hls.detachMedia(); } catch (e) {}
          try { hls.destroy(); } catch (e) {}
          hls = null;
        }
      }

      function loadTrack(next, keepTime) {
        var src = streams[next];
        if (!src) {
          fail('That audio track is not available.');
          return;
        }
        if (switching) return;
        if (next === track && hls) {
          syncAudioButtons();
          syncCcButtons();
          return;
        }

        switching = true;
        clearErr();
        var resumeAt = keepTime ? (video.currentTime || 0) : 0;
        var wasPlaying = !video.paused || keepTime;
        track = next;
        syncAudioButtons();
        updateSkip();

        try {
          var u = new URL(location.href);
          u.searchParams.set('t', next);
          history.replaceState(null, '', u);
        } catch (e) {}

        stage.classList.add('is-loading');
        try { video.pause(); } catch (e) {}
        destroyHls();
        unloadCaptions();
        video.removeAttribute('src');
        try { video.load(); } catch (e) {}

        function finishReady() {
          video.playbackRate = rate;
          applyCaptions();
          var finished = false;
          var start = function () {
            if (finished) return;
            finished = true;
            stage.classList.remove('is-loading');
            switching = false;
            if (wasPlaying) video.play().catch(function () { setPlaying(false); });
            else setPlaying(false);
          };
          if (resumeAt > 0.5 && isFinite(resumeAt)) {
            var onMeta = function () {
              try { video.currentTime = resumeAt; } catch (e) {}
              video.addEventListener('seeked', start, { once: true });
              setTimeout(start, 1200);
            };
            if (video.readyState >= 1) onMeta();
            else video.addEventListener('loadedmetadata', onMeta, { once: true });
          } else {
            start();
          }
          fillQuality();
        }

        if (window.Hls && Hls.isSupported()) {
          var hlsNetworkRetries = 0;
          var hlsMediaRetries = 0;
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startLevel: -1,
            // Prevent live-stream playlist polling on VOD content
            liveDurationInfinity: false,
            // Cap buffer to avoid filling RAM with segments
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            backBufferLength: 30,
            // Limit retries so a flaky CDN doesn't spam the Worker indefinitely
            manifestLoadingMaxRetry: 2,
            levelLoadingMaxRetry: 2,
            fragLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 1000,
            levelLoadingRetryDelay: 1000,
            fragLoadingRetryDelay: 1000,
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, function () {
            hlsNetworkRetries = 0;
            hlsMediaRetries = 0;
            // Restore manual quality level if user already picked one
            if (qualityManual >= 0 && qualityManual < hls.levels.length) {
              hls.currentLevel = qualityManual;
            }
            finishReady(); // fillQuality() is called inside finishReady
          });
          hls.on(Hls.Events.ERROR, function (_e, data) {
            if (!data || !data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Cap manual recovery attempts — don't loop forever on a dead CDN
              if (hlsNetworkRetries < 2) {
                hlsNetworkRetries++;
                try { hls.startLoad(); return; } catch (e) {}
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              if (hlsMediaRetries < 2) {
                hlsMediaRetries++;
                try { hls.recoverMediaError(); return; } catch (e) {}
              }
            }
            var alt = next === 'sub' ? 'dub' : 'sub';
            var hasAlt = Boolean(streams[alt]);
            if (hasAlt) {
              fail('Could not load ' + next.toUpperCase() + ' (' + data.type + ').', alt);
            } else {
              fail('Could not load ' + next.toUpperCase() + ' (' + data.type + '). Try another server.');
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src;
          video.addEventListener('loadedmetadata', finishReady, { once: true });
        } else if (!window.Hls && document.readyState !== 'complete') {
          window.addEventListener('load', function () {
            if (window.Hls && Hls.isSupported()) loadTrack(next, keepTime);
            else fail('This browser cannot play HLS. Try Chrome, Firefox, or Safari.');
          }, { once: true });
        } else {
          fail('This browser cannot play HLS. Try Chrome, Firefox, or Safari.');
        }
      }

      var lastSettingsTrigger = null;
      var lastEpTrigger = null;

      function trapDialogFocus(e, dialogEl, closeFn) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeFn();
          return;
        }
        if (e.key !== 'Tab') return;
        var focusables = dialogEl.querySelectorAll('button:not([disabled]):not([hidden]), [href]:not([aria-disabled="true"]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !dialogEl.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogEl.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      function syncBackdrop() {
        var anyOpen = (settingsMenu && settingsMenu.classList.contains('is-open')) ||
                      (epPanel && epPanel.classList.contains('is-open'));
        if (sheetBackdrop) {
          sheetBackdrop.classList.toggle('is-active', anyOpen);
          sheetBackdrop.hidden = !anyOpen;
        }
      }

      function toggleSettings(force) {
        var open = typeof force === 'boolean' ? force : !settingsMenu.classList.contains('is-open');
        settingsMenu.classList.toggle('is-open', open);
        stage.classList.toggle('settings-open', open);
        settingsBtn.classList.toggle('is-on', open);
        settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        syncBackdrop();
        if (open) {
          lastSettingsTrigger = document.activeElement;
          setEpPanel(false);
          pokeControls();
          var firstFocus = settingsMenu.querySelector('button:not([disabled]), select:not([disabled]), input:not([disabled])');
          if (firstFocus) {
            try { firstFocus.focus(); } catch (err) {}
          }
        } else if (lastSettingsTrigger && typeof lastSettingsTrigger.focus === 'function') {
          try { lastSettingsTrigger.focus(); } catch (err) {}
          lastSettingsTrigger = null;
        }
      }

      function setEpPanel(open) {
        if (!epPanel || !animeId) return;
        epPanel.hidden = !open;
        epPanel.classList.toggle('is-open', open);
        if (epListBtn) {
          epListBtn.classList.toggle('is-active', open);
          epListBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (epListBtnMenu) {
          epListBtnMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        syncBackdrop();
        if (open) {
          lastEpTrigger = document.activeElement;
          toggleSettings(false);
          pokeControls();
          loadEpisodeList();
          if (epPanelClose) {
            try { epPanelClose.focus(); } catch (err) {}
          }
        } else if (lastEpTrigger && typeof lastEpTrigger.focus === 'function') {
          try { lastEpTrigger.focus(); } catch (err) {}
          lastEpTrigger = null;
        }
      }

      function toggleEpPanel() {
        if (!animeId) return;
        setEpPanel(!(epPanel && epPanel.classList.contains('is-open')));
      }

      function playEpisodeId(episodeId, btn) {
        if (!episodeId) return;
        var params = new URLSearchParams({
          animeEpisodeId: String(episodeId).replace(/::/g, '?'),
          category: playCategory === 'dub' ? 'dub' : 'sub',
        });
        location.href = '/api/v2/hianime/watch/play?' + params.toString();
      }

      function readEpsCache() {
        if (!animeId) return null;
        try {
          var raw = sessionStorage.getItem('ani.eps.' + animeId);
          if (!raw) return null;
          var parsed = JSON.parse(raw);
          if (!parsed || !parsed.expires || parsed.expires < Date.now()) return null;
          if (!parsed.data || !Array.isArray(parsed.data.episodes)) return null;
          return parsed.data;
        } catch (e) {
          return null;
        }
      }

      function writeEpsCache(data) {
        if (!animeId || !data) return;
        try {
          sessionStorage.setItem(
            'ani.eps.' + animeId,
            JSON.stringify({ expires: Date.now() + 15 * 60 * 1000, data: data })
          );
        } catch (e) {}
      }

      function renderEpisodeList(data) {
        if (!epList || !epPanelStatus) return;
        var episodes = (data && data.episodes) || [];
        if (!episodes.length) {
          epList.hidden = true;
          epPanelStatus.hidden = false;
          epPanelStatus.textContent = 'No episodes found.';
          return;
        }
        epPanelStatus.hidden = true;
        epList.hidden = false;
        epList.innerHTML = '';
        var cur = currentEpNum != null ? String(currentEpNum) : '';
        var currentEl = null;
        episodes.forEach(function (ep) {
          if (!ep || !ep.id) return;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ep-item' + (ep.filler ? ' is-filler' : '');
          var n = ep.n != null ? String(ep.n) : '';
          if (n && n === cur) {
            btn.className += ' is-current';
            currentEl = btn;
          }
          if (n) btn.setAttribute('data-epn', n);
          // Mark as watched if in localStorage
          if (n && animeId) {
            try {
              var _watched = JSON.parse(localStorage.getItem('ani.watched.' + animeId) || '[]');
              if (_watched.indexOf(n) >= 0) btn.className += ' is-watched';
            } catch (e) {}
          }
          btn.innerHTML =
            '<span class="ep-n">' + (n || '—') + '</span>' +
            '<span class="ep-t"></span>';
          btn.querySelector('.ep-t').textContent = ep.title || ('Episode ' + (n || ''));
          (function (epId, epBtn) {
            epBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              playEpisodeId(epId, epBtn);
            });
          })(ep.id, btn);
          epList.appendChild(btn);
        });
        if (currentEl && typeof currentEl.scrollIntoView === 'function') {
          try { currentEl.scrollIntoView({ block: 'center' }); } catch (e) {}
        }
      }

      function loadEpisodeList() {
        if (!animeId || !epPanelStatus) return;
        var cached = readEpsCache();
        if (cached) {
          renderEpisodeList(cached);
          return;
        }
        epList.hidden = true;
        epPanelStatus.hidden = false;
        epPanelStatus.textContent = 'Loading…';
        fetch('/api/v2/hianime/watch/episodes?anime=' + encodeURIComponent(animeId))
          .then(function (r) {
            if (!r.ok) throw new Error('list ' + r.status);
            return r.json();
          })
          .then(function (json) {
            var data = json && json.data ? json.data : json;
            if (!data || !Array.isArray(data.episodes)) throw new Error('bad list');
            writeEpsCache(data);
            renderEpisodeList(data);
          })
          .catch(function () {
            epList.hidden = true;
            epPanelStatus.hidden = false;
            epPanelStatus.innerHTML = '<span>Could not load episodes.</span> ';
            var retryBtn = document.createElement('button');
            retryBtn.type = 'button';
            retryBtn.className = 'pill';
            retryBtn.style.padding = '4px 10px';
            retryBtn.style.fontSize = '0.75rem';
            retryBtn.textContent = 'Retry';
            retryBtn.addEventListener('click', function () {
              loadEpisodeList();
            });
            epPanelStatus.appendChild(retryBtn);
          });
      }

      // Wire UI
      fillSpeeds();
      setRate(rate);
      setTheater(theater);
      syncAudioButtons();
      syncCcButtons();

      var lastTapTime = 0;
      var lastTapX = 0;
      var tapTimer = null;
      var gestureTimer = null;

      function flashGesture(side) {
        var el = side === 'left' ? gestureLeft : gestureRight;
        if (!el) return;
        el.classList.add('is-active');
        clearTimeout(gestureTimer);
        gestureTimer = setTimeout(function () {
          el.classList.remove('is-active');
        }, 400);
      }

      playBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });
      bigPlay.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });
      video.addEventListener('click', function () {
        if (window.matchMedia('(pointer: coarse)').matches) {
          // Handled by stage pointerup on touch devices
          return;
        }
        if (settingsMenu.classList.contains('is-open')) toggleSettings(false);
        else togglePlay();
      });

      stage.addEventListener('pointerup', function (e) {
        if (!window.matchMedia('(pointer: coarse)').matches) return;
        if (e.target.closest('.controls, .menu, .ep-panel, .big-btn, .skip-btn, .ap-overlay, button, a, input, select, [role="switch"]')) {
          return;
        }

        var now = Date.now();
        var dt = now - lastTapTime;
        var rect = stage.getBoundingClientRect();
        var tapX = e.clientX - rect.left;
        var width = rect.width;

        if (dt < 320 && Math.abs(tapX - lastTapX) < 60) {
          clearTimeout(tapTimer);
          tapTimer = null;
          lastTapTime = 0;

          if (tapX < width * 0.38) {
            video.currentTime = Math.max(0, (video.currentTime || 0) - 10);
            updateProgress();
            updateSkip();
            flashGesture('left');
          } else if (tapX > width * 0.62) {
            video.currentTime = Math.min((video.duration || 0), (video.currentTime || 0) + 10);
            updateProgress();
            updateSkip();
            flashGesture('right');
          } else {
            togglePlay();
          }
          pokeControls();
        } else {
          lastTapTime = now;
          lastTapX = tapX;
          clearTimeout(tapTimer);
          tapTimer = setTimeout(function () {
            tapTimer = null;
            if (settingsMenu.classList.contains('is-open')) {
              toggleSettings(false);
            } else if (epPanel && epPanel.classList.contains('is-open')) {
              setEpPanel(false);
            } else {
              if (stage.classList.contains('show-controls') && !video.paused) {
                stage.classList.remove('show-controls');
                stage.classList.add('cursor-hidden');
              } else {
                pokeControls();
              }
            }
          }, 280);
        }
      });
      muteBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });
      fsBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFs(); });
      settingsBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        toggleSettings();
      });
      if (settingsClose) {
        settingsClose.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleSettings(false);
        });
      }
      if (sheetBackdrop) {
        sheetBackdrop.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleSettings(false);
          setEpPanel(false);
        });
      }
      if (epListBtn) {
        epListBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleEpPanel();
        });
      }
      if (epListBtnMenu) {
        epListBtnMenu.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleSettings(false);
          setEpPanel(true);
        });
      }
      if (epPanelClose) {
        epPanelClose.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          setEpPanel(false);
        });
      }
      theaterBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        setTheater(!theater);
      });
      theaterToggle.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        setTheater(!theater);
      });
      function onCcClick(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!captions[track]) return;
        setCc(!ccOn);
      }
      if (ccBtn) ccBtn.addEventListener('click', onCcClick);
      if (ccTop) ccTop.addEventListener('click', onCcClick);
      if (ccToggle) ccToggle.addEventListener('click', onCcClick);
      if (ccSize) {
        ccSize.addEventListener('input', function (e) {
          e.stopPropagation();
          ccSizePx = Number(ccSize.value) || 28;
          applyCcStyle();
          persistCcLayout();
        });
        ccSize.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      if (ccOpacityEl) {
        ccOpacityEl.addEventListener('input', function (e) {
          e.stopPropagation();
          ccOpacity = Number(ccOpacityEl.value) || 100;
          applyCcStyle();
          persistCcLayout();
        });
        ccOpacityEl.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      document.querySelectorAll('[data-cc-preset]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var preset = btn.getAttribute('data-cc-preset');
          if (preset === 'anime') {
            ccStyle = 'outline';
            ccFontKey = 'rosario';
            ccColorKey = 'white';
            ccEdgeKey = 'black';
            ccBgKey = 'none';
          } else if (preset === 'box') {
            ccStyle = 'box';
            ccFontKey = 'dm';
            ccColorKey = 'white';
            ccEdgeKey = 'black';
            ccBgKey = 'dark';
          }
          applyCcStyle();
          persistCcLayout();
        });
      });
      document.querySelectorAll('[data-cc-style]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          ccStyle = btn.getAttribute('data-cc-style') || 'box';
          applyCcStyle();
          persistCcLayout();
        });
      });
      document.querySelectorAll('[data-cc-color]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          ccColorKey = btn.getAttribute('data-cc-color') || 'white';
          applyCcStyle();
          persistCcLayout();
        });
      });
      document.querySelectorAll('[data-cc-font]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          ccFontKey = btn.getAttribute('data-cc-font') || 'sans';
          applyCcStyle();
          persistCcLayout();
        });
      });
      document.querySelectorAll('[data-cc-edge]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          ccEdgeKey = btn.getAttribute('data-cc-edge') || 'black';
          applyCcStyle();
          persistCcLayout();
        });
      });
      document.querySelectorAll('[data-cc-bg]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          ccBgKey = btn.getAttribute('data-cc-bg') || 'none';
          applyCcStyle();
          persistCcLayout();
        });
      });
      // CC section collapse
      var ccCollapseBtn = document.getElementById('ccCollapseBtn');
      var ccBody = document.getElementById('ccBody');
      function setCcCollapsed(on) {
        ccCollapsed = !!on;
        if (ccBody) ccBody.classList.toggle('is-collapsed', ccCollapsed);
        if (ccCollapseBtn) {
          ccCollapseBtn.textContent = ccCollapsed ? '▼ Show' : '▲ Hide';
          ccCollapseBtn.setAttribute('aria-expanded', ccCollapsed ? 'false' : 'true');
        }
        try { localStorage.setItem('ani.ccCollapsed', ccCollapsed ? '1' : '0'); } catch (e) {}
      }
      if (ccCollapseBtn) {
        ccCollapseBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          setCcCollapsed(!ccCollapsed);
        });
      }
      // Apply saved collapse state on load
      setCcCollapsed(ccCollapsed);
      document.querySelectorAll('[data-cc-pos]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          setCcPos(btn.getAttribute('data-cc-pos') || 'bottom');
        });
      });
      if (ccBox) {
        ccBox.addEventListener('pointerdown', function (e) {
          if (!ccOn) return;
          e.preventDefault();
          e.stopPropagation();
          draggingCc = true;
          ccBox.classList.add('is-dragging');
          ccBox.setPointerCapture(e.pointerId);
          // Record where within the box the pointer landed (as % of stage)
          var rect = stage.getBoundingClientRect();
          if (rect.width && rect.height) {
            var pctX = ((e.clientX - rect.left) / rect.width) * 100;
            var pctY = ((rect.bottom - e.clientY) / rect.height) * 100;
            ccDragOffsetX = pctX - ccX;
            ccDragOffsetY = pctY - ccY;
          }
        });
        ccBox.addEventListener('pointermove', function (e) {
          if (!draggingCc) return;
          e.preventDefault();
          var rect = stage.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          var pctX = ((e.clientX - rect.left) / rect.width) * 100;
          var pctY = ((rect.bottom - e.clientY) / rect.height) * 100;
          ccX = Math.min(92, Math.max(8, pctX - ccDragOffsetX));
          ccY = Math.min(90, Math.max(4, pctY - ccDragOffsetY));
          applyCcStyle();
        });
        function endCcDrag(e) {
          if (!draggingCc) return;
          draggingCc = false;
          ccBox.classList.remove('is-dragging');
          try { ccBox.releasePointerCapture(e.pointerId); } catch (err) {}
          persistCcLayout();
        }
        ccBox.addEventListener('pointerup', endCcDrag);
        ccBox.addEventListener('pointercancel', endCcDrag);
        ccBox.addEventListener('lostpointercapture', endCcDrag);
        window.addEventListener('blur', function () { if (draggingCc) endCcDrag({}); });
        ccBox.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
        });
      }
      applyCcStyle();
      if (settingsMenu) {
        settingsMenu.addEventListener('keydown', function (e) {
          trapDialogFocus(e, settingsMenu, function () { toggleSettings(false); });
        });
      }
      if (epPanel) {
        epPanel.addEventListener('keydown', function (e) {
          trapDialogFocus(e, epPanel, function () { setEpPanel(false); });
        });
      }
      loopToggle.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        video.loop = !video.loop;
        loopToggle.classList.toggle('is-on', video.loop);
        loopToggle.setAttribute('aria-pressed', video.loop ? 'true' : 'false');
        loopToggle.setAttribute('aria-checked', video.loop ? 'true' : 'false');
      });
      speedBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        toggleSettings(true);
      });
      pipBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else if (video.requestPictureInPicture) video.requestPictureInPicture().catch(function () {});
      });

      // Cast to TV — Remote Playback API (Chrome/Edge, Chromecast, smart TVs)
      // Falls back gracefully: row is hidden if the API isn't available.
      var castRow = document.getElementById('castRow');
      var castBtn = document.getElementById('castBtn');
      (function initCast() {
        // Remote Playback API (Chrome 56+, Edge, Android Chrome)
        if (video.remote && typeof video.remote.prompt === 'function') {
          if (castRow) castRow.hidden = false;
          if (castBtn) {
            video.remote.watchAvailability(function (available) {
              if (castRow) castRow.hidden = !available;
            }).catch(function () {
              // watchAvailability not supported — show the button anyway and let prompt() fail gracefully
              if (castRow) castRow.hidden = false;
            });
            castBtn.addEventListener('click', function (e) {
              e.preventDefault(); e.stopPropagation();
              video.remote.prompt().catch(function () {});
            });
          }
        } else if (window.PresentationRequest) {
          // Presentation API fallback (older Chromecasts / some smart TV browsers)
          var presentUrl = location.href;
          var req = null;
          try { req = new PresentationRequest([presentUrl]); } catch (err) {}
          if (req && castRow) {
            castRow.hidden = false;
            if (castBtn) {
              castBtn.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                req.start().catch(function () {});
              });
            }
          }
        }
      })();
      quality.addEventListener('change', function () {
        if (!hls) return;
        var v = Number(quality.value);
        hls.currentLevel = v;
        qualityManual = v;
      });

      // Auto-play overlay buttons
      (function () {
        var apNow = document.getElementById('apNow');
        var apCancel = document.getElementById('apCancel');
        if (apNow) {
          apNow.addEventListener('click', function () {
            if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
            var nextHref = document.getElementById('nextEpBar') ? document.getElementById('nextEpBar').getAttribute('href') : null;
            if (nextHref) location.href = nextHref;
          });
        }
        if (apCancel) {
          apCancel.addEventListener('click', function () {
            autoplayCancelled = true;
            if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
            var overlay = document.getElementById('autoplayOverlay');
            if (overlay) overlay.setAttribute('hidden', '');
          });
        }
      })();

      document.querySelectorAll('[data-track]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var next = btn.getAttribute('data-track');
          if (!next || !streams[next]) {
            fail('That audio track is not available.');
            return;
          }
          loadTrack(next, true);
        });
      });

      seek.addEventListener('input', function () {
        if (!video.duration) return;
        video.currentTime = (Number(seek.value) / 1000) * video.duration;
        updateProgress();
        updateSkip();
      });
      vol.addEventListener('input', function () {
        applyVolume(vol.value);
      });

      if (skipBtn) {
        skipBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          doSkip();
        });
      }

      video.addEventListener('timeupdate', function () {
        updateProgress();
        updateSkip();
        renderCcAt(video.currentTime || 0);
        cwThrottle(video.currentTime || 0);
      });
      video.addEventListener('seeked', function () {
        updateSkip();
        renderCcAt(video.currentTime || 0);
      });
      video.addEventListener('ended', function () {
        // Guard: ignore spurious 'ended' events fired during track switches
        // (video.load() can reset duration to 0 and briefly fire ended)
        if (!isFinite(video.duration) || video.duration < 5) return;
        cwRemove(); // finished — remove from continue watching
        // Mark watched
        if (animeId && currentEpNum) {
          try {
            var watched = JSON.parse(localStorage.getItem('ani.watched.' + animeId) || '[]');
            if (watched.indexOf(String(currentEpNum)) < 0) {
              watched.push(String(currentEpNum));
              localStorage.setItem('ani.watched.' + animeId, JSON.stringify(watched));
            }
          } catch (e) {}
        }
        // Auto-play next episode
        var nextHref = document.getElementById('nextEpBar') ? document.getElementById('nextEpBar').getAttribute('href') : null;
        if (!nextHref) return;
        // Clear any previous timer before starting a new one
        if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
        autoplayCancelled = false;
        var overlay = document.getElementById('autoplayOverlay');
        if (!overlay) return;
        var countEl = overlay.querySelector('.ap-count');
        var secs = 12;
        overlay.removeAttribute('hidden');
        if (countEl) countEl.textContent = String(secs);
        autoplayTimer = setInterval(function () {
          secs--;
          if (countEl) countEl.textContent = String(secs);
          if (autoplayCancelled || secs <= 0) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
            overlay.setAttribute('hidden', '');
            if (!autoplayCancelled) location.href = nextHref;
          }
        }, 1000);
      });
      video.addEventListener('loadedmetadata', function () {
        updateProgress();
        updateSkip();
      });
      video.addEventListener('ratechange', function () {
        if (Math.abs(video.playbackRate - rate) > 0.01) setRate(video.playbackRate);
      });
      video.addEventListener('play', function () { setPlaying(true); stage.classList.remove('is-loading'); });
      video.addEventListener('pause', function () {
        setPlaying(false);
        // Always show cursor when paused — controls are visible via is-paused CSS rule
        stage.classList.remove('cursor-hidden');
        clearTimeout(hideTimer);
      });
      video.addEventListener('waiting', function () { stage.classList.add('is-loading'); });
      video.addEventListener('playing', function () { stage.classList.remove('is-loading'); });
      video.addEventListener('canplay', function () { stage.classList.remove('is-loading'); });

      stage.addEventListener('mousemove', pokeControls);
      stage.addEventListener('mouseleave', function () {
        // When the cursor leaves the stage entirely, immediately hide controls (if playing)
        clearTimeout(hideTimer);
        if (!video.paused && !settingsMenu.classList.contains('is-open')) {
          stage.classList.remove('show-controls');
          stage.classList.add('cursor-hidden');
        }
      });
      stage.addEventListener('mouseenter', pokeControls);
      stage.addEventListener('touchstart', pokeControls, { passive: true });
      document.addEventListener('click', function (e) {
        if (settingsMenu.classList.contains('is-open')) {
          if (!(settingsMenu.contains(e.target) || settingsBtn.contains(e.target) || speedBtn.contains(e.target))) {
            toggleSettings(false);
          }
        }
        if (epPanel && epPanel.classList.contains('is-open')) {
          if (epPanel.contains(e.target)) return;
          if (epListBtn && epListBtn.contains(e.target)) return;
          if (epListBtnMenu && epListBtnMenu.contains(e.target)) return;
          setEpPanel(false);
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
        else if (e.key === 'f' || e.key === 'F') toggleFs();
        else if (e.key === 't' || e.key === 'T') setTheater(!theater);
        else if (e.key === 'e' || e.key === 'E') {
          if (animeId) { e.preventDefault(); toggleEpPanel(); }
        }
        else if (e.key === 'c' || e.key === 'C') {
          if (captions[track]) setCc(!ccOn);
        }
        else if (e.key === '[') {
          e.preventDefault();
          var prev = document.getElementById('prevEpBar') || document.getElementById('prevEp');
          if (prev && prev.getAttribute('href')) location.href = prev.getAttribute('href');
        }
        else if (e.key === ']') {
          e.preventDefault();
          var next = document.getElementById('nextEpBar') || document.getElementById('nextEp');
          if (next && next.getAttribute('href')) location.href = next.getAttribute('href');
        }
        else if (e.key === 'm' || e.key === 'M') toggleMute();
        else if (e.key === 's' || e.key === 'S') { if (streams.sub) loadTrack('sub', true); }
        else if (e.key === 'd' || e.key === 'D') { if (streams.dub) loadTrack('dub', true); }
        else if (e.key === ',' || e.key === '<') cycleRate(-1);
        else if (e.key === '.' || e.key === '>') cycleRate(1);
        else if (e.key === 'ArrowRight') { e.preventDefault(); video.currentTime = Math.min((video.duration || 0), video.currentTime + 10); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); applyVolume(video.volume + 0.05); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); applyVolume(video.volume - 0.05); }
        else if (e.key === 'Escape') {
          if (epPanel && epPanel.classList.contains('is-open')) setEpPanel(false);
          else if (settingsMenu.classList.contains('is-open')) toggleSettings(false);
          else if (theater && !document.fullscreenElement) setTheater(false);
        }
        pokeControls();
      });

      function initMediaSession() {
        if (!('mediaSession' in navigator)) return;
        try {
          var msTitle = (currentEpNum ? 'Ep ' + currentEpNum : 'Episode') + (currentEpTitle ? ' · ' + currentEpTitle : '');
          var artworkList = [];
          if (animeId) {
            try {
              var meta = JSON.parse(localStorage.getItem('ani.meta.' + animeId) || 'null');
              if (meta && meta.poster) {
                artworkList.push({ src: meta.poster, sizes: '300x450', type: 'image/jpeg' });
              }
            } catch (e) {}
          }
          navigator.mediaSession.metadata = new MediaMetadata({
            title: msTitle,
            artist: animeName || ${safeJson(SITE_NAME)},
            album: animeName || ${safeJson(SITE_NAME)},
            artwork: artworkList,
          });
          navigator.mediaSession.setActionHandler('play', function () { togglePlay(); });
          navigator.mediaSession.setActionHandler('pause', function () { togglePlay(); });
          navigator.mediaSession.setActionHandler('seekbackward', function (details) {
            var skipTime = (details && details.seekOffset) || 10;
            video.currentTime = Math.max((video.currentTime || 0) - skipTime, 0);
          });
          navigator.mediaSession.setActionHandler('seekforward', function (details) {
            var skipTime = (details && details.seekOffset) || 10;
            video.currentTime = Math.min((video.currentTime || 0) + skipTime, video.duration || 0);
          });
          var prevNav = document.getElementById('prevEpBar') || document.getElementById('prevEp');
          if (prevNav && prevNav.getAttribute('href')) {
            navigator.mediaSession.setActionHandler('previoustrack', function () {
              location.href = prevNav.getAttribute('href');
            });
          }
          var nextNav = document.getElementById('nextEpBar') || document.getElementById('nextEp');
          if (nextNav && nextNav.getAttribute('href')) {
            navigator.mediaSession.setActionHandler('nexttrack', function () {
              location.href = nextNav.getAttribute('href');
            });
          }
        } catch (e) {}
      }

      function init() {
        setPlaying(false);
        setMuted(false);
        // Restore saved volume level
        var savedVol = 1;
        try {
          savedVol = parseFloat(localStorage.getItem('ani.vol') || '1');
        } catch (e) {}
        if (isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) {
          applyVolume(savedVol);
        } else {
          applyVolume(1);
        }
        loadTrack(track, false);
        initMediaSession();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
  </script>
  ${vercelObservabilityScriptTags()}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export default watchController;

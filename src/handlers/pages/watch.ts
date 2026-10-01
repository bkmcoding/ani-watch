import { Context } from 'hono';
import { validationError } from '../../lib/errors';
import {
  proxiedHlsUrl,
  proxiedVttUrl,
  requestOrigin,
  watchPlayUrl,
} from '../../lib/streamUrls';
import { faviconLinkTags, SITE_NAME, titleFromAnimeSlug } from '../../lib/brand';
import { NOTICE_SHORT } from '../../lib/notices';
import { vercelObservabilityScriptTags } from '../../lib/vercelObservability';

function parseAllowedUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // Only require https:// — the HLS proxy enforces the CDN allowlist when
    // the URL is actually fetched, so double-checking here just breaks on new CDN hostnames.
    if (!/^https?:$/i.test(u.protocol) || !u.hostname || u.hostname.length < 3) return null;
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
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function parseSkipRange(
  startRaw: string | undefined,
  endRaw: string | undefined
): SkipRange {
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

  const initial =
    preferredRaw === 'dub' && resolvedDub ? 'dub' : resolvedSub ? 'sub' : 'dub';
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
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
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
      --radius: 18px;
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
        radial-gradient(900px 500px at 100% 100%, rgba(80, 110, 180, 0.1), transparent 50%),
        linear-gradient(180deg, #0d1118 0%, var(--bg0) 45%, #080a0e 100%);
    }
    @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
    .page {
      min-height: 100dvh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: clamp(16px, 3vw, 28px);
      gap: 18px;
      transition: padding 0.35s var(--ease);
    }
    header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      max-width: var(--stage-max); width: 100%; margin: 0 auto;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .brand {
      font-family: Syne, sans-serif; font-weight: 700;
      font-size: clamp(1.35rem, 2.4vw, 1.75rem); letter-spacing: -0.03em; margin: 0;
    }
    .brand span { color: var(--accent); }
    .brand-wrap { display: flex; flex-direction: column; gap: 2px; }
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
    .header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
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
      bottom: var(--cc-y, 16%);
      top: auto;
      transform: translateX(-50%);
      max-width: min(92%, 920px);
      width: max-content;
      text-align: center;
      pointer-events: auto;
      cursor: grab;
      user-select: none;
      touch-action: none;
      padding: var(--cc-pad, 0.3em 0.65em);
      border-radius: 10px;
      /* bg/color set dynamically via --cc-bg and --cc-color */
      background: var(--cc-bg, rgba(0,0,0,0.72));
      color: var(--cc-color, #fff);
      font-family: "DM Sans", system-ui, sans-serif;
      font-size: var(--cc-size, 28px);
      font-weight: var(--cc-weight, 600);
      line-height: 1.4;
      letter-spacing: 0.01em;
      text-shadow: var(--cc-shadow, 0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7));
      -webkit-text-stroke: var(--cc-stroke, 0px transparent);
      white-space: pre-wrap;
      word-break: break-word;
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    .cc-box.is-visible { opacity: 1; }
    .cc-box.is-dragging { cursor: grabbing; transition: none; }
    .cc-box:empty { display: none; }
    /* Caption style presets */
    .cc-box[data-style="outline"] {
      background: transparent;
      -webkit-text-stroke: 1.5px rgba(0,0,0,0.9);
      text-shadow: 0 0 6px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8);
      padding: 0.2em 0.5em;
    }
    .cc-box[data-style="raised"] {
      background: transparent;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.5);
      padding: 0.2em 0.5em;
    }
    .cc-box[data-style="drop"] {
      background: transparent;
      text-shadow: 0 3px 8px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,0.9);
      padding: 0.2em 0.5em;
    }
    .cc-box[data-style="box"] {
      background: rgba(0,0,0,0.82);
      text-shadow: none;
      padding: 0.3em 0.7em;
      border-radius: 6px;
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
      display: block; font-size: 2rem; font-weight: 700; color: var(--accent);
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
      width: 40px; height: 40px; border-radius: 10px;
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
      padding: 6px 8px; border-radius: 8px; cursor: pointer; min-width: 42px;
    }
    .speed-chip:hover, .speed-chip.is-active { color: var(--accent); border-color: rgba(61,214,198,0.4); background: var(--accent-dim); }
    .menu {
      position: absolute; right: 12px; bottom: 58px;
      width: min(300px, calc(100% - 24px));
      max-height: min(80dvh, 600px); overflow-y: auto; overflow-x: hidden;
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 14px; padding: 12px; box-shadow: 0 18px 50px rgba(0,0,0,0.45);
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
      color: var(--ink); border-radius: 10px; padding: 8px 10px; font: inherit;
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
      color: var(--muted); font-size: 0.8rem;
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
      padding: 8px 10px; border-radius: 10px; width: 100%;
      transition: background 0.15s ease;
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
      content: "F"; margin-left: 4px; font-size: 0.65rem; opacity: 0.7;
    }

    /* Theater mode */
    body.theater { background: #000; }
    body.theater .page { padding: 0; gap: 0; }
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

    @media (max-width: 720px) {
      .vol { display: none; }
      .hint { display: none; }
      .time { min-width: auto; }
      .stage { aspect-ratio: 16 / 9; border-radius: 12px; }
      .big-btn { width: 68px; height: 68px; }
      /* Bigger touch targets for controls */
      .ctrl { width: 44px; height: 44px; }
      .pill { padding: 10px 14px; font-size: 0.86rem; min-height: 40px; }
      header { gap: 10px; }
      .header-right { gap: 8px; }
    }
    /* Small phone: 375–480px */
    @media (max-width: 480px) {
      .page { padding: 10px 10px 16px; gap: 10px; }
      .brand { font-size: 1.15rem; }
      .ep-line { max-width: calc(100vw - 24px); font-size: 0.72rem; white-space: normal; line-height: 1.3; }
      .stage { border-radius: 8px; }
      .menu { right: 8px; bottom: 56px; width: calc(100% - 16px); max-height: 70dvh; overflow-y: auto; }
      .ep-panel { left: 8px; bottom: 56px; width: calc(100% - 16px); }
      .skip-btn { right: 8px; bottom: 72px; font-size: 12px; padding: 8px 12px; }
      .big-btn { width: 60px; height: 60px; }
      .big-btn svg { width: 26px; height: 26px; }
      footer { font-size: 0.78rem; flex-direction: column; gap: 4px; }
      /* Speed chip smaller */
      .speed-chip { padding: 5px 7px; font-size: 0.72rem; min-width: 36px; }
      /* Header: stack brand on top, controls below, smaller pills */
      header { flex-direction: column; align-items: flex-start; gap: 8px; }
      .header-right { width: 100%; gap: 6px; flex-wrap: wrap; }
      .header-right .pill { font-size: 0.78rem; padding: 7px 10px; min-height: 36px; }
      /* Controls bar: two rows */
      .row { flex-wrap: wrap; gap: 2px; }
      /* Primary row: play, mute, time take up full width first */
      .row .time { flex: 1; }
      /* Nav pills and right-side controls wrap to second line */
      .nav-pill { font-size: 0.78rem; padding: 6px 10px; }
      /* Ensure seek bar is full width and easy to tap */
      .seek { height: 10px; margin-bottom: 12px; }
      .seek::-webkit-slider-thumb { width: 20px; height: 20px; margin-top: -5px; }
    }
    /* Landscape phone */
    @media (max-height: 500px) and (orientation: landscape) {
      .page { padding: 6px; gap: 6px; }
      header { display: none; }
      .stage { aspect-ratio: auto; height: calc(100dvh - 72px); border-radius: 0; }
      .stage-wrap { min-height: 0; }
      footer { display: none; }
    }
    /* Very small phone: <360px */
    @media (max-width: 360px) {
      .provider-pill { display: none; }
      .speed-chip { display: none; }
      .header-right .pill { font-size: 0.74rem; padding: 6px 8px; }
      .ctrl { width: 40px; height: 40px; }
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
        <button type="button" class="pill" id="epListBtn" title="Episode list (E)" ${hasAnime ? '' : 'hidden'}>Episodes</button>
        <a class="pill" href="/browse" title="Back to browse" style="opacity:0.7">← Browse</a>
      </div>
    </header>

    <div class="stage-wrap">
      <div class="stage is-loading is-paused" id="stage">
        <video id="v" playsinline preload="auto"></video>
        <div class="cc-layer" id="ccLayer" aria-live="polite">
          <div class="cc-box" id="ccBox" title="Drag to move"></div>
        </div>
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

        <div class="ep-panel" id="epPanel" role="dialog" aria-label="Episode list" hidden>
          <div class="ep-panel-head">
            <h3>Episodes</h3>
            <button type="button" class="pill" id="epPanelClose" style="padding:6px 10px">Close</button>
          </div>
          <p class="ep-panel-status" id="epPanelStatus">Loading…</p>
          <div class="ep-list" id="epList" hidden></div>
        </div>

        <div class="menu" id="settingsMenu" role="dialog" aria-label="Player settings">
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
            <button type="button" class="pill" id="epListBtnMenu" style="width:100%;margin-top:8px;justify-content:center" ${hasAnime ? '' : 'hidden'}>All episodes</button>
            <p class="hint" style="margin-top:8px">${epIndex && epTotal ? escAttr(`Episode ${epIndex} of ${epTotal}`) : 'Jump with Prev / Next or the episode list.'}</p>
          </div>
          <div class="menu-section" id="ccSection">
            <div class="menu-section-head" id="ccSectionHead">
              <h3 style="margin:0">Subtitles</h3>
              <button type="button" class="pill" id="ccCollapseBtn" style="padding:4px 10px;font-size:0.75rem" aria-expanded="true" aria-controls="ccBody">▲ Hide</button>
            </div>
            <div id="ccBody">
              <div class="menu-row">
                <label for="ccToggle">English CC</label>
                <button type="button" class="switch" id="ccToggle" aria-pressed="false" ${hasAnyCc ? '' : 'disabled'}></button>
              </div>
              <div id="ccControls" ${hasAnyCc ? '' : 'hidden'}>
                <div class="menu-row" style="flex-direction:column;align-items:stretch;gap:8px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <label for="ccSize">Size</label>
                    <span class="hint" id="ccSizeLabel">30px</span>
                  </div>
                  <input class="menu-slider" id="ccSize" type="range" min="16" max="56" step="1" value="30" aria-label="Caption size" />
                </div>
                <div class="menu-row" style="flex-direction:column;align-items:stretch;gap:8px;padding-top:4px">
                  <label>Font</label>
                  <div class="pos-row" id="ccFontRow" style="flex-wrap:wrap">
                    <button type="button" class="pill" data-cc-font="sans" style="font-family:system-ui,sans-serif">Sans</button>
                    <button type="button" class="pill is-active" data-cc-font="dm" style="font-family:'DM Sans',sans-serif">DM Sans</button>
                    <button type="button" class="pill" data-cc-font="serif" style="font-family:Georgia,serif">Serif</button>
                    <button type="button" class="pill" data-cc-font="mono" style="font-family:'Courier New',monospace">Mono</button>
                  </div>
                </div>
                <div class="menu-row" style="flex-direction:column;align-items:stretch;gap:8px;padding-top:4px">
                  <label>Style</label>
                  <div class="pos-row" id="ccStyleRow">
                    <button type="button" class="pill" data-cc-style="box">Box</button>
                    <button type="button" class="pill is-active" data-cc-style="outline">Outline</button>
                    <button type="button" class="pill" data-cc-style="raised">Raised</button>
                    <button type="button" class="pill" data-cc-style="drop">Drop</button>
                  </div>
                </div>
                <div class="menu-row" style="flex-direction:column;align-items:stretch;gap:8px;padding-top:4px">
                  <label>Color</label>
                  <div class="pos-row" id="ccColorRow">
                    <button type="button" class="pill is-active" data-cc-color="white" style="color:#fff">White</button>
                    <button type="button" class="pill" data-cc-color="yellow" style="color:#ffe066">Yellow</button>
                    <button type="button" class="pill" data-cc-color="cyan" style="color:#3dd6c6">Cyan</button>
                    <button type="button" class="pill" data-cc-color="lime" style="color:#86efac">Lime</button>
                  </div>
                </div>
                <div class="menu-row" style="flex-direction:column;align-items:stretch;gap:8px;padding-top:4px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <label for="ccOpacity">Opacity</label>
                    <span class="hint" id="ccOpacityLabel">100%</span>
                  </div>
                  <input class="menu-slider" id="ccOpacity" type="range" min="30" max="100" step="5" value="100" aria-label="Caption opacity" />
                </div>
                <div class="menu-row" style="flex-direction:column;align-items:stretch;gap:8px;padding-top:4px">
                  <label>Position</label>
                  <div class="pos-row" id="ccPosRow">
                    <button type="button" class="pill" data-cc-pos="top">Top</button>
                    <button type="button" class="pill" data-cc-pos="middle">Mid</button>
                    <button type="button" class="pill is-active" data-cc-pos="bottom">Bottom</button>
                  </div>
                  <p class="hint" style="margin:0">Or drag the captions on the video.</p>
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
              <label for="loopToggle">Loop</label>
              <button type="button" class="switch" id="loopToggle" aria-pressed="false"></button>
            </div>
            <div class="menu-row">
              <label for="theaterToggle">Theater mode</label>
              <button type="button" class="switch" id="theaterToggle" aria-pressed="false"></button>
            </div>
            <div class="menu-row">
              <label>Picture in picture</label>
              <button type="button" class="pill" id="pipBtn" style="padding:6px 10px">Pop out</button>
            </div>
            <div class="menu-row" id="castRow" hidden>
              <label>Cast to TV</label>
              <button type="button" class="pill" id="castBtn" style="padding:6px 10px" title="Cast to a nearby screen or smart TV">📺 Cast</button>
            </div>
            <div class="menu-row" style="flex-direction:column;align-items:flex-start;gap:6px;padding-top:4px;border-top:1px solid var(--line);margin-top:4px">
              <label style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted)">Keyboard shortcuts</label>
              <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:0.78rem;color:var(--muted);width:100%">
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">Space</kbd><span>Play / Pause</span>
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">← →</kbd><span>Seek ±10s</span>
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">[ ]</kbd><span>Prev / Next episode</span>
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">F</kbd><span>Fullscreen</span>
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">T</kbd><span>Theater mode</span>
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">C</kbd><span>Captions on/off</span>
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">M</kbd><span>Mute</span>
                <kbd style="font-family:monospace;background:var(--surface2);border-radius:4px;padding:1px 5px">, .</kbd><span>Speed down / up</span>
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
            <a class="pill nav-pill" id="prevEpBar" ${prevPlaySafe ? `href="${escAttr(prevPlaySafe)}"` : 'aria-disabled="true" tabindex="-1"'} ${prevPlaySafe ? '' : 'hidden'} style="padding:6px 10px;min-width:auto">← Prev</a>
            <a class="pill nav-pill" id="nextEpBar" ${nextPlaySafe ? `href="${escAttr(nextPlaySafe)}"` : 'aria-disabled="true" tabindex="-1"'} ${nextPlaySafe ? '' : 'hidden'} style="padding:6px 10px;min-width:auto">Next →</a>
            <button type="button" class="ctrl" id="ccBtn" aria-label="English captions" title="English CC (C)" ${hasAnyCc ? '' : 'hidden'}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8.5 10.5c-.8 0-1.4-.3-1.9-.8l.9-.9c.3.3.6.5 1 .5.5 0 .8-.3.8-.7 0-.5-.4-.7-1.1-.7H9.5v-1.2h.7c.5 0 .9-.2.9-.6 0-.3-.2-.6-.7-.6-.3 0-.6.1-.8.4l-.9-.8c.4-.5 1-.8 1.8-.8 1.2 0 1.9.6 1.9 1.4 0 .5-.3.9-.8 1.1.6.2 1 0.7 1 1.3 0 1-.9 1.4-2.1 1.4zm7 0c-.8 0-1.4-.3-1.9-.8l.9-.9c.3.3.6.5 1 .5.5 0 .8-.3.8-.7 0-.5-.4-.7-1.1-.7h-.7v-1.2h.7c.5 0 .9-.2.9-.6 0-.3-.2-.6-.7-.6-.3 0-.6.1-.8.4l-.9-.8c.4-.5 1-.8 1.8-.8 1.2 0 1.9.6 1.9 1.4 0 .5-.3.9-.8 1.1.6.2 1 .7 1 1.3 0 1-.9 1.4-2.1 1.4z"/></svg>
            </button>
            <span class="spacer"></span>
            <button type="button" class="ctrl" id="settingsBtn" aria-label="Settings" title="Settings">
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
      var streams = ${JSON.stringify(streams)};
      var captions = ${JSON.stringify(captions)};
      var skips = ${JSON.stringify(skips)};
      var providers = ${JSON.stringify(providers)};
      var animeId = ${JSON.stringify(animeId)};
      var animeName = ${JSON.stringify(animeTitle || '')};
      var playCategory = ${JSON.stringify(category)};
      var currentEpNum = ${JSON.stringify(epNum)};
      var currentEpTitle = ${JSON.stringify(epTitle || '')};
      var PROVIDER_LABELS = { megaplay: 'MegaPlay', zoko: 'Zoko' };
      var track = ${JSON.stringify(initial)};
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
      var hideTimer = null;
      var hls = null;
      var switching = false;
      var skipMode = null;
      var rate = Number(localStorage.getItem('ani.rate') || '1') || 1;
      var theater = localStorage.getItem('ani.theater') === '1';
      var ccOn = localStorage.getItem('ani.cc') === '1';
      var ccSizePx = Math.min(56, Math.max(16, Number(localStorage.getItem('ani.ccSize') || '30') || 30));
      var ccX = Number(localStorage.getItem('ani.ccX') || 'NaN');
      var ccY = Number(localStorage.getItem('ani.ccY') || 'NaN');
      var CC_STYLES = ['box', 'outline', 'raised', 'drop'];
      var CC_COLORS = { white: '#fff', yellow: '#ffe066', cyan: '#3dd6c6', lime: '#86efac' };
      var CC_FONTS = { sans: 'system-ui,sans-serif', dm: '"DM Sans",sans-serif', serif: 'Georgia,serif', mono: '"Courier New",monospace' };
      var ccStyle = CC_STYLES.indexOf(localStorage.getItem('ani.ccStyle') || '') >= 0 ? localStorage.getItem('ani.ccStyle') : 'outline';
      var ccColorKey = CC_COLORS[localStorage.getItem('ani.ccColor')] ? localStorage.getItem('ani.ccColor') : 'white';
      var ccFontKey = CC_FONTS[localStorage.getItem('ani.ccFont')] ? localStorage.getItem('ani.ccFont') : 'dm';
      var ccOpacity = Math.min(100, Math.max(30, Number(localStorage.getItem('ani.ccOpacity') || '100') || 100));
      var ccCollapsed = localStorage.getItem('ani.ccCollapsed') !== '0'; // collapsed by default unless user explicitly opened it
      if (!isFinite(ccX)) ccX = 50;
      if (!isFinite(ccY)) ccY = 16;
      var ccCues = [];
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

      function fail(msg) {
        err.hidden = false;
        err.textContent = msg;
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
      }

      function setMuted(muted) {
        muteIcon.innerHTML = muted || video.volume === 0 ? ICONS.muted : ICONS.vol;
        muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      }

      function updateProgress() {
        var d = video.duration || 0;
        var t = video.currentTime || 0;
        if (!seek.matches(':active')) seek.value = String(d ? (t / d) * 1000 : 0);
        seek.style.setProperty('--progress', (d ? (t / d) * 100 : 0) + '%');
        timeEl.textContent = fmt(t) + ' / ' + fmt(d);
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
        }, 2800);
      }

      function togglePlay() {
        if (video.paused) video.play().catch(function () {});
        else video.pause();
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
        theaterBtn.classList.toggle('is-on', theater);
        localStorage.setItem('ani.theater', theater ? '1' : '0');
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
          cues.push({ start: parseTs(m[1]), end: parseTs(m[2]), text: body });
        }
        return cues;
      }

      function applyCcStyle() {
        if (!ccBox) return;
        ccBox.style.setProperty('--cc-size', ccSizePx + 'px');
        ccBox.style.setProperty('--cc-x', ccX + '%');
        ccBox.style.setProperty('--cc-y', ccY + '%');
        // Font
        ccBox.style.fontFamily = CC_FONTS[ccFontKey] || 'system-ui,sans-serif';
        // Style preset
        ccBox.setAttribute('data-style', ccStyle);
        // Color
        var color = CC_COLORS[ccColorKey] || '#fff';
        ccBox.style.setProperty('--cc-color', color);
        // Weight
        ccBox.style.setProperty('--cc-weight', '600');
        // Opacity
        ccBox.style.opacity = String(ccOpacity / 100);
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
        // Sync color buttons
        document.querySelectorAll('[data-cc-color]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cc-color') === ccColorKey);
        });
        // Sync font buttons
        document.querySelectorAll('[data-cc-font]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cc-font') === ccFontKey);
        });
      }

      function persistCcLayout() {
        localStorage.setItem('ani.ccSize', String(ccSizePx));
        localStorage.setItem('ani.ccX', String(Math.round(ccX * 10) / 10));
        localStorage.setItem('ani.ccY', String(Math.round(ccY * 10) / 10));
        localStorage.setItem('ani.ccStyle', ccStyle);
        localStorage.setItem('ani.ccColor', ccColorKey);
        localStorage.setItem('ani.ccFont', ccFontKey);
        localStorage.setItem('ani.ccOpacity', String(ccOpacity));
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
        ccSrcLoaded = '';
        hideCcText();
        if (ccLayer) ccLayer.classList.remove('is-on');
        // Also disable any leftover native tracks from older sessions
        try {
          Array.from(video.querySelectorAll('track')).forEach(function (el) { el.remove(); });
          Array.from(video.textTracks || []).forEach(function (tt) { tt.mode = 'disabled'; });
        } catch (e) {}
      }

      function renderCcAt(t) {
        if (!ccOn || !ccCues.length) {
          hideCcText();
          return;
        }
        var text = '';
        for (var i = 0; i < ccCues.length; i++) {
          var c = ccCues[i];
          if (t >= c.start && t <= c.end) {
            text = text ? text + '\\n' + c.text : c.text;
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
        hideCcText();
        fetch(src)
          .then(function (r) {
            if (!r.ok) throw new Error('cc ' + r.status);
            return r.text();
          })
          .then(function (text) {
            if (token !== ccFetchToken) return;
            ccCues = parseVtt(text);
            ccSrcLoaded = src;
            renderCcAt(video.currentTime || 0);
          })
          .catch(function () {
            if (token !== ccFetchToken) return;
            ccCues = [];
            ccSrcLoaded = '';
            hideCcText();
          });
      }

      function setCc(on) {
        ccOn = !!on;
        localStorage.setItem('ani.cc', ccOn ? '1' : '0');
        if (!ccOn) unloadCaptions();
        applyCaptions();
      }

      function setRate(next) {
        rate = next;
        video.playbackRate = rate;
        speedBtn.textContent = (rate % 1 === 0 ? rate.toFixed(0) : String(rate)) + 'x';
        localStorage.setItem('ani.rate', String(rate));
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
            }
            fail('Could not load ' + next.toUpperCase() + ' (' + data.type + '). Try the other track.');
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src;
          video.addEventListener('loadedmetadata', finishReady, { once: true });
        } else {
          fail('This browser cannot play HLS. Try Chrome, Firefox, or Safari.');
        }
      }

      function toggleSettings(force) {
        var open = typeof force === 'boolean' ? force : !settingsMenu.classList.contains('is-open');
        settingsMenu.classList.toggle('is-open', open);
        stage.classList.toggle('settings-open', open);
        settingsBtn.classList.toggle('is-on', open);
        if (open) {
          setEpPanel(false);
          pokeControls();
        }
      }

      function setEpPanel(open) {
        if (!epPanel || !animeId) return;
        epPanel.hidden = !open;
        epPanel.classList.toggle('is-open', open);
        if (epListBtn) epListBtn.classList.toggle('is-active', open);
        if (open) {
          toggleSettings(false);
          pokeControls();
          loadEpisodeList();
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
            epPanelStatus.textContent = 'Could not load episodes.';
          });
      }

      // Wire UI
      fillSpeeds();
      setRate(rate);
      setTheater(theater);
      syncAudioButtons();
      syncCcButtons();

      playBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });
      bigPlay.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });
      video.addEventListener('click', function () {
        if (settingsMenu.classList.contains('is-open')) toggleSettings(false);
        else togglePlay();
      });
      muteBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });
      fsBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleFs(); });
      settingsBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        toggleSettings();
      });
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
        localStorage.setItem('ani.ccCollapsed', ccCollapsed ? '1' : '0');
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
        ccBox.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
        });
      }
      applyCcStyle();
      loopToggle.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        video.loop = !video.loop;
        loopToggle.classList.toggle('is-on', video.loop);
        loopToggle.setAttribute('aria-pressed', video.loop ? 'true' : 'false');
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
        video.volume = Number(vol.value);
        video.muted = video.volume === 0;
        vol.style.setProperty('--vol', video.volume * 100 + '%');
        setMuted(video.muted);
        localStorage.setItem('ani.vol', String(video.volume));
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
          var prev = document.getElementById('prevEp');
          if (prev && prev.getAttribute('href')) location.href = prev.getAttribute('href');
        }
        else if (e.key === ']') {
          var next = document.getElementById('nextEp');
          if (next && next.getAttribute('href')) location.href = next.getAttribute('href');
        }
        else if (e.key === 'm' || e.key === 'M') toggleMute();
        else if (e.key === 's' || e.key === 'S') { if (streams.sub) loadTrack('sub', true); }
        else if (e.key === 'd' || e.key === 'D') { if (streams.dub) loadTrack('dub', true); }
        else if (e.key === ',' || e.key === '<') cycleRate(-1);
        else if (e.key === '.' || e.key === '>') cycleRate(1);
        else if (e.key === 'ArrowRight') video.currentTime = Math.min((video.duration || 0), video.currentTime + 10);
        else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
        else if (e.key === 'Escape') {
          if (epPanel && epPanel.classList.contains('is-open')) setEpPanel(false);
          else if (settingsMenu.classList.contains('is-open')) toggleSettings(false);
          else if (theater && !document.fullscreenElement) setTheater(false);
        }
        pokeControls();
      });

      setPlaying(false);
      setMuted(false);
      // Restore saved volume level
      var savedVol = parseFloat(localStorage.getItem('ani.vol') || '1');
      if (isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) {
        video.volume = savedVol;
        vol.value = String(savedVol);
      }
      vol.style.setProperty('--vol', video.volume * 100 + '%');
      loadTrack(track, false);
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

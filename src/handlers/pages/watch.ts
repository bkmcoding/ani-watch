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
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
      background:
        radial-gradient(1200px 600px at 50% -10%, rgba(61, 214, 198, 0.12), transparent 55%),
        radial-gradient(900px 500px at 100% 100%, rgba(80, 110, 180, 0.1), transparent 50%),
        linear-gradient(180deg, #0d1118 0%, var(--bg0) 45%, #080a0e 100%);
    }
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
      margin: 2px 0 0;
      font-size: 0.8rem;
      color: var(--muted);
      max-width: min(420px, 70vw);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
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
      bottom: var(--cc-y, 12%);
      top: auto;
      transform: translateX(-50%);
      max-width: min(92%, 920px);
      width: max-content;
      text-align: center;
      pointer-events: auto;
      cursor: grab;
      user-select: none;
      touch-action: none;
      padding: 0.35em 0.7em;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.62);
      color: #fff;
      font-family: "DM Sans", system-ui, sans-serif;
      font-size: var(--cc-size, 32px);
      font-weight: 700;
      line-height: 1.35;
      letter-spacing: 0.01em;
      text-shadow: 0 2px 4px rgba(0,0,0,0.85);
      white-space: pre-wrap;
      word-break: break-word;
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    .cc-box.is-visible { opacity: 1; }
    .cc-box.is-dragging { cursor: grabbing; transition: none; }
    .cc-box:empty { display: none; }
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
    .stage:hover .skip-btn.is-visible, .stage.is-paused .skip-btn.is-visible,
    .stage.show-controls .skip-btn.is-visible, .stage:focus-within .skip-btn.is-visible {
      opacity: 1;
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
    .stage:hover .controls, .stage.is-paused .controls,
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
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 14px; padding: 12px; box-shadow: 0 18px 50px rgba(0,0,0,0.45);
      display: none; z-index: 5; backdrop-filter: blur(16px);
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

    @media (max-width: 720px) {
      .vol, .hint { display: none; }
      .time { min-width: auto; }
      .stage { aspect-ratio: 16 / 10; border-radius: 14px; }
      .big-btn { width: 64px; height: 64px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="brand-wrap">
        <h1 class="brand">ani<span>.</span>watch</h1>
        <p class="brand-by">by <em>wab</em></p>
        ${hasEpisodeMeta ? `<p class="ep-line" title="${subtitle}">${subtitle}</p>` : ''}
      </div>
      <div class="header-right">
        <a class="pill" href="/browse" title="Back to browse">Browse</a>
        <button type="button" class="pill" id="epListBtn" title="Episode list (E)" ${hasAnime ? '' : 'hidden'}>Episodes</button>
        <div class="pill-toggle" id="epNav" ${hasNav ? '' : 'hidden'}>
          <a class="pill nav-pill" id="prevEp" ${prevPlaySafe ? `href="${escAttr(prevPlaySafe)}"` : 'aria-disabled="true" tabindex="-1"'} ${prevPlaySafe ? '' : 'hidden'}>← Prev</a>
          <a class="pill nav-pill" id="nextEp" ${nextPlaySafe ? `href="${escAttr(nextPlaySafe)}"` : 'aria-disabled="true" tabindex="-1"'} ${nextPlaySafe ? '' : 'hidden'}>Next →</a>
        </div>
        <div class="pill-toggle" id="audioToggle" ${hasEither ? '' : 'hidden'}>
          <button type="button" class="pill ${initial === 'sub' ? 'is-active' : ''}" data-track="sub" ${!hasSub ? 'disabled aria-disabled="true" title="Subtitled version unavailable"' : ''}>Sub</button>
          <button type="button" class="pill ${initial === 'dub' ? 'is-active' : ''}" data-track="dub" ${!hasDub ? 'disabled aria-disabled="true" title="Dubbed version unavailable"' : ''}>Dub</button>
        </div>
        <span class="pill provider-pill" id="providerBadge" title="Stream provider" ${initialProviderLabel ? '' : 'hidden'}>${escAttr(initialProviderLabel)}</span>
        <button type="button" class="pill" id="ccTop" title="English subtitles (C)" ${hasAnyCc ? '' : 'hidden'} aria-pressed="false">CC</button>
        <button type="button" class="pill" id="theaterTop" title="Theater mode">Theater</button>
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
            <h3>Subtitles</h3>
            <div class="menu-row">
              <label for="ccToggle">English CC</label>
              <button type="button" class="switch" id="ccToggle" aria-pressed="false" ${hasAnyCc ? '' : 'disabled'}></button>
            </div>
            <div id="ccControls" ${hasAnyCc ? '' : 'hidden'}>
              <div class="menu-row" style="flex-direction:column;align-items:stretch;gap:8px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <label for="ccSize">Size</label>
                  <span class="hint" id="ccSizeLabel">32px</span>
                </div>
                <input class="menu-slider" id="ccSize" type="range" min="20" max="56" step="1" value="32" aria-label="Caption size" />
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
      <span>${SITE_NAME} · by wab · Sub/Dub · CC · Episodes · Prev/Next<span id="footerProvider">${initialProviderLabel ? ` · ${escAttr(initialProviderLabel)}` : ''}</span><br />${NOTICE_SHORT}</span>
      <a href="/browse">Browse</a>
    </footer>
  </div>

  <script>
    (function () {
      var streams = ${JSON.stringify(streams)};
      var captions = ${JSON.stringify(captions)};
      var skips = ${JSON.stringify(skips)};
      var providers = ${JSON.stringify(providers)};
      var animeId = ${JSON.stringify(animeId)};
      var playCategory = ${JSON.stringify(category)};
      var currentEpNum = ${JSON.stringify(epNum)};
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
      var theaterTop = document.getElementById('theaterTop');
      var ccToggle = document.getElementById('ccToggle');
      var ccBtn = document.getElementById('ccBtn');
      var ccTop = document.getElementById('ccTop');
      var ccLayer = document.getElementById('ccLayer');
      var ccBox = document.getElementById('ccBox');
      var ccSize = document.getElementById('ccSize');
      var ccSizeLabel = document.getElementById('ccSizeLabel');
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
      var ccSizePx = Math.min(56, Math.max(20, Number(localStorage.getItem('ani.ccSize') || '32') || 32));
      var ccX = Number(localStorage.getItem('ani.ccX'));
      var ccY = Number(localStorage.getItem('ani.ccY'));
      if (!isFinite(ccX)) ccX = 50;
      if (!isFinite(ccY)) ccY = 12;
      var ccCues = [];
      var ccSrcLoaded = '';
      var ccFetchToken = 0;
      var activeCueText = '';
      var draggingCc = false;

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
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          if (!video.paused && !settingsMenu.classList.contains('is-open')) {
            stage.classList.remove('show-controls');
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
        if (!document.fullscreenElement) (stage.requestFullscreen && stage.requestFullscreen()) || (stage.webkitRequestFullscreen && stage.webkitRequestFullscreen());
        else document.exitFullscreen && document.exitFullscreen();
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
        if (ccSize) ccSize.value = String(ccSizePx);
        if (ccSizeLabel) ccSizeLabel.textContent = ccSizePx + 'px';
        document.querySelectorAll('[data-cc-pos]').forEach(function (btn) {
          var pos = btn.getAttribute('data-cc-pos');
          var active =
            (pos === 'top' && ccY >= 78) ||
            (pos === 'middle' && ccY >= 40 && ccY < 78) ||
            (pos === 'bottom' && ccY < 40);
          btn.classList.toggle('is-active', active);
        });
      }

      function persistCcLayout() {
        localStorage.setItem('ani.ccSize', String(ccSizePx));
        localStorage.setItem('ani.ccX', String(Math.round(ccX * 10) / 10));
        localStorage.setItem('ani.ccY', String(Math.round(ccY * 10) / 10));
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
        // Also update the footer subtext
        var footerProv = document.getElementById('footerProvider');
        if (footerProv) footerProv.textContent = label ? ' · ' + label : '';
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
        quality.value = String(hls.autoLevelEnabled ? -1 : hls.currentLevel);
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
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startLevel: -1,
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, function () {
            finishReady();
          });
          hls.on(Hls.Events.ERROR, function (_e, data) {
            if (!data || !data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              try { hls.startLoad(); return; } catch (e) {}
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
        // Mark as loading
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = '0.5';
        }
        var params = new URLSearchParams({
          animeEpisodeId: String(episodeId).replace(/::/g, '?'),
          category: playCategory === 'dub' ? 'dub' : 'sub',
        });
        // Preflight — check if the episode is actually playable before navigating.
        // /watch/play returns 302 on success; on failure it returns 4xx/5xx JSON.
        fetch('/api/v2/hianime/watch/play?' + params.toString(), { redirect: 'manual' })
          .then(function (r) {
            if (r.type === 'opaqueredirect' || (r.status >= 200 && r.status < 400)) {
              // Success — navigate
              location.href = '/api/v2/hianime/watch/play?' + params.toString();
            } else {
              // Unavailable — grey out the button permanently in this session
              if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Episode unavailable';
                var nEl = btn.querySelector('.ep-n');
                if (nEl) nEl.style.color = 'var(--danger)';
                // Store in sessionStorage so it persists while the panel is open
                try {
                  var key = 'ani.unavail.' + animeId;
                  var set = JSON.parse(sessionStorage.getItem(key) || '[]');
                  if (set.indexOf(String(episodeId)) < 0) set.push(String(episodeId));
                  sessionStorage.setItem(key, JSON.stringify(set));
                } catch (e) {}
              }
            }
          })
          .catch(function () {
            // Network error — just navigate anyway (may recover)
            location.href = '/api/v2/hianime/watch/play?' + params.toString();
          });
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
        // Restore any previously detected unavailable episodes
        var unavailSet = [];
        try {
          if (animeId) unavailSet = JSON.parse(sessionStorage.getItem('ani.unavail.' + animeId) || '[]');
        } catch (e) {}
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
          btn.innerHTML =
            '<span class="ep-n">' + (n || '—') + '</span>' +
            '<span class="ep-t"></span>';
          btn.querySelector('.ep-t').textContent = ep.title || ('Episode ' + (n || ''));
          // Restore unavailable state
          if (unavailSet.indexOf(String(ep.id)) >= 0) {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Episode unavailable';
            var nEl = btn.querySelector('.ep-n');
            if (nEl) nEl.style.color = 'var(--danger)';
          }
          (function (epId, epBtn) {
            epBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              if (epBtn.disabled) return;
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
      theaterTop.addEventListener('click', function (e) {
        e.preventDefault();
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
          ccSizePx = Number(ccSize.value) || 32;
          applyCcStyle();
          persistCcLayout();
        });
        ccSize.addEventListener('click', function (e) { e.stopPropagation(); });
      }
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
        });
        ccBox.addEventListener('pointermove', function (e) {
          if (!draggingCc) return;
          e.preventDefault();
          var rect = stage.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          ccX = Math.min(92, Math.max(8, ((e.clientX - rect.left) / rect.width) * 100));
          ccY = Math.min(90, Math.max(4, ((rect.bottom - e.clientY) / rect.height) * 100));
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
      quality.addEventListener('change', function () {
        if (!hls) return;
        var v = Number(quality.value);
        hls.currentLevel = v;
      });

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
      });
      video.addEventListener('seeked', function () {
        updateSkip();
        renderCcAt(video.currentTime || 0);
      });
      video.addEventListener('loadedmetadata', function () {
        updateProgress();
        updateSkip();
      });
      video.addEventListener('ratechange', function () {
        if (Math.abs(video.playbackRate - rate) > 0.01) setRate(video.playbackRate);
      });
      video.addEventListener('play', function () { setPlaying(true); stage.classList.remove('is-loading'); });
      video.addEventListener('pause', function () { setPlaying(false); });
      video.addEventListener('waiting', function () { stage.classList.add('is-loading'); });
      video.addEventListener('playing', function () { stage.classList.remove('is-loading'); });
      video.addEventListener('canplay', function () { stage.classList.remove('is-loading'); });

      stage.addEventListener('mousemove', pokeControls);
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
          else if (theater && !document.fullscreenElement) setTheater(false);
        }
        pokeControls();
      });

      setPlaying(false);
      setMuted(false);
      vol.style.setProperty('--vol', '100%');
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

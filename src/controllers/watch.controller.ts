import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { isAllowedStreamHost, proxiedHlsUrl, requestOrigin } from '../utils/streamUrls';

function parseAllowedUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!/^https?:$/i.test(u.protocol) || !isAllowedStreamHost(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

const watchController = async (c: Context) => {
  const subCdn = parseAllowedUrl(c.req.query('sub') || undefined);
  const dubCdn = parseAllowedUrl(c.req.query('dub') || undefined);
  const legacy = parseAllowedUrl(c.req.query('url') || undefined);
  const subCcCdn = parseAllowedUrl(c.req.query('subCc') || undefined);
  const dubCcCdn = parseAllowedUrl(c.req.query('dubCc') || undefined);
  const preferredRaw = (c.req.query('t') || 'sub').toLowerCase();

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
  const streams = {
    sub: resolvedSub ? proxiedHlsUrl(origin, resolvedSub) : null,
    dub: resolvedDub ? proxiedHlsUrl(origin, resolvedDub) : null,
  };
  const captions = {
    sub: subCcCdn ? proxiedHlsUrl(origin, subCcCdn) : null,
    dub: dubCcCdn ? proxiedHlsUrl(origin, dubCcCdn) : null,
  };
  const hasBoth = Boolean(streams.sub && streams.dub);
  const hasAnyCc = Boolean(captions.sub || captions.dub);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>Watch</title>
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
    }
    .pill:hover { color: var(--ink); }
    .pill.is-active { background: var(--accent-dim); color: var(--accent); }
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
      width: min(280px, calc(100% - 24px));
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
    }

    video::-webkit-media-text-track-display { overflow: visible !important; }
    video::cue {
      font-family: "DM Sans", system-ui, sans-serif;
      font-size: clamp(16px, 2.2vw, 22px);
      font-weight: 600;
      line-height: 1.35;
      color: #fff;
      background: rgba(0, 0, 0, 0.55);
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
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
      <h1 class="brand">ani<span>.</span>watch</h1>
      <div class="header-right">
        <div class="pill-toggle" id="audioToggle" ${hasBoth ? '' : 'hidden'}>
          <button type="button" class="pill ${initial === 'sub' ? 'is-active' : ''}" data-track="sub" ${streams.sub ? '' : 'hidden'}>Sub</button>
          <button type="button" class="pill ${initial === 'dub' ? 'is-active' : ''}" data-track="dub" ${streams.dub ? '' : 'hidden'}>Dub</button>
        </div>
        <button type="button" class="pill" id="ccTop" title="English subtitles (C)" ${hasAnyCc ? '' : 'hidden'} aria-pressed="false">CC</button>
        <button type="button" class="pill" id="theaterTop" title="Theater mode">Theater</button>
        <p class="hint">Space · F full · T theater · C captions · S/D audio · &lt; &gt; speed</p>
      </div>
    </header>

    <div class="stage-wrap">
      <div class="stage is-loading is-paused" id="stage">
        <video id="v" playsinline preload="auto"></video>
        <div class="overlay">
          <button type="button" class="big-btn" id="bigPlay" aria-label="Play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="spinner" aria-hidden="true"></div>
        </div>

        <div class="menu" id="settingsMenu" role="dialog" aria-label="Player settings">
          <div class="menu-section">
            <h3>Audio</h3>
            <div class="pill-toggle" id="audioToggleMenu" ${hasBoth ? '' : 'hidden'} style="width:100%;justify-content:stretch">
              <button type="button" class="pill ${initial === 'sub' ? 'is-active' : ''}" data-track="sub" style="flex:1" ${streams.sub ? '' : 'hidden'}>Sub</button>
              <button type="button" class="pill ${initial === 'dub' ? 'is-active' : ''}" data-track="dub" style="flex:1" ${streams.dub ? '' : 'hidden'}>Dub</button>
            </div>
            <p class="hint" id="audioHint" style="margin-top:8px;${hasBoth ? 'display:none' : ''}">Only one audio track is available for this episode.</p>
          </div>
          <div class="menu-section">
            <h3>Subtitles</h3>
            <div class="menu-row">
              <label for="ccToggle">English CC</label>
              <button type="button" class="switch" id="ccToggle" aria-pressed="false" ${hasAnyCc ? '' : 'disabled'}></button>
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
    <footer>Sub/Dub · English CC · speed · theater · settings — press C for captions</footer>
  </div>

  <script>
    (function () {
      var streams = ${JSON.stringify(streams)};
      var captions = ${JSON.stringify(captions)};
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
      var pipBtn = document.getElementById('pipBtn');
      var hideTimer = null;
      var hls = null;
      var switching = false;
      var rate = Number(localStorage.getItem('ani.rate') || '1') || 1;
      var theater = localStorage.getItem('ani.theater') === '1';
      var ccOn = localStorage.getItem('ani.cc') === '1';

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
      }

      function clearTextTracks() {
        Array.from(video.querySelectorAll('track')).forEach(function (el) {
          try { el.remove(); } catch (e) {}
        });
        try {
          Array.from(video.textTracks || []).forEach(function (tt) {
            tt.mode = 'disabled';
          });
        } catch (e) {}
      }

      function applyCaptions() {
        clearTextTracks();
        var src = captions[track];
        if (!ccOn || !src) {
          syncCcButtons();
          return;
        }
        var el = document.createElement('track');
        el.kind = 'subtitles';
        el.label = 'English';
        el.srclang = 'en';
        el.src = src;
        el.default = true;
        video.appendChild(el);
        var enable = function () {
          try {
            Array.from(video.textTracks || []).forEach(function (tt) {
              tt.mode = (tt.language === 'en' || /english/i.test(tt.label || '')) ? 'showing' : 'disabled';
            });
            if (video.textTracks && video.textTracks.length && video.textTracks[0].mode !== 'showing') {
              video.textTracks[0].mode = 'showing';
            }
          } catch (e) {}
        };
        el.addEventListener('load', enable);
        setTimeout(enable, 250);
        syncCcButtons();
      }

      function setCc(on) {
        ccOn = !!on;
        localStorage.setItem('ani.cc', ccOn ? '1' : '0');
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

        try {
          var u = new URL(location.href);
          u.searchParams.set('t', next);
          history.replaceState(null, '', u);
        } catch (e) {}

        stage.classList.add('is-loading');
        try { video.pause(); } catch (e) {}
        destroyHls();
        clearTextTracks();
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
        if (open) pokeControls();
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
      });
      vol.addEventListener('input', function () {
        video.volume = Number(vol.value);
        video.muted = video.volume === 0;
        vol.style.setProperty('--vol', video.volume * 100 + '%');
        setMuted(video.muted);
      });

      video.addEventListener('timeupdate', updateProgress);
      video.addEventListener('loadedmetadata', updateProgress);
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
        if (!settingsMenu.classList.contains('is-open')) return;
        if (settingsMenu.contains(e.target) || settingsBtn.contains(e.target) || speedBtn.contains(e.target)) return;
        toggleSettings(false);
      });

      document.addEventListener('keydown', function (e) {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
        else if (e.key === 'f' || e.key === 'F') toggleFs();
        else if (e.key === 't' || e.key === 'T') setTheater(!theater);
        else if (e.key === 'c' || e.key === 'C') {
          if (captions[track]) setCc(!ccOn);
        }
        else if (e.key === 'm' || e.key === 'M') toggleMute();
        else if (e.key === 's' || e.key === 'S') { if (streams.sub) loadTrack('sub', true); }
        else if (e.key === 'd' || e.key === 'D') { if (streams.dub) loadTrack('dub', true); }
        else if (e.key === ',' || e.key === '<') cycleRate(-1);
        else if (e.key === '.' || e.key === '>') cycleRate(1);
        else if (e.key === 'ArrowRight') video.currentTime = Math.min((video.duration || 0), video.currentTime + 10);
        else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
        else if (e.key === 'Escape' && theater && !document.fullscreenElement) setTheater(false);
        pokeControls();
      });

      setPlaying(false);
      setMuted(false);
      vol.style.setProperty('--vol', '100%');
      loadTrack(track, false);
    })();
  </script>
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

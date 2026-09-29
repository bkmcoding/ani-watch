import { Context } from 'hono';
import { faviconLinkTags, SITE_NAME, SITE_TAGLINE } from '../../lib/brand';
import { NOTICE_SHORT } from '../../lib/notices';
import { vercelObservabilityScriptTags } from '../../lib/vercelObservability';
import { mediaProxySecret, posterProxyBase, requestOrigin } from '../../lib/streamUrls';

const browseController = async (c: Context) => {
  const origin = requestOrigin(c);
  const posterProxy = posterProxyBase(origin);
  const posterKey = mediaProxySecret();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>Browse — ${SITE_NAME}</title>
  <meta name="description" content="Discover trending anime, browse categories, and watch on ${SITE_NAME}" />
  ${faviconLinkTags(origin)}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg0: #07090d;
      --ink: #e8edf5;
      --muted: #8b95a8;
      --accent: #3dd6c6;
      --accent-dim: rgba(61, 214, 198, 0.16);
      --danger: #ff7b72;
      --line: rgba(255, 255, 255, 0.1);
      --panel: rgba(12, 16, 24, 0.88);
      --radius: 16px;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
      --max: 1180px;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg0); color: var(--ink); font-family: "DM Sans", system-ui, sans-serif; }
    body {
      min-height: 100dvh;
      animation: fadein 0.3s ease both;
      background:
        radial-gradient(1100px 560px at 30% -12%, rgba(61, 214, 198, 0.14), transparent 55%),
        radial-gradient(900px 500px at 100% 70%, rgba(70, 100, 180, 0.12), transparent 50%),
        linear-gradient(180deg, #0d1219 0%, var(--bg0) 42%, #05070a 100%);
    }
    @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
    .page {
      max-width: var(--max);
      margin: 0 auto;
      padding: clamp(16px, 3vw, 28px);
      display: grid;
      gap: 16px;
      min-height: 100dvh;
      grid-template-rows: auto auto auto auto;
    }
    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }
    .brand-wrap { display: flex; flex-direction: column; gap: 2px; }
    .brand {
      font-family: Syne, sans-serif;
      font-weight: 800;
      margin: 0;
      font-size: clamp(1.55rem, 3vw, 2.05rem);
      letter-spacing: -0.035em;
    }
    .brand a { color: inherit; text-decoration: none; }
    .brand span { color: var(--accent); }
    .byline {
      margin: 0;
      font-size: 0.72rem;
      letter-spacing: 0.06em;
      color: var(--muted);
      text-transform: lowercase;
    }
    .byline em { font-style: normal; color: var(--accent); font-weight: 600; }
    .nav { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill {
      appearance: none;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.03);
      color: var(--muted);
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 999px;
      cursor: pointer;
      transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    }
    .pill:hover, .pill.is-active {
      color: var(--accent);
      background: var(--accent-dim);
      border-color: rgba(61,214,198,0.35);
    }
    .search-dock {
      position: sticky;
      top: 10px;
      z-index: 20;
      display: grid;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 50px rgba(0,0,0,0.35);
    }
    .search-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
    }
    @media (max-width: 640px) {
      .search-row { grid-template-columns: 1fr; }
    }
    label.field-label {
      display: block;
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    input[type="search"], input[type="password"], input[type="text"] {
      width: 100%;
      appearance: none;
      border: 1px solid var(--line);
      background: rgba(0,0,0,0.32);
      color: var(--ink);
      font: inherit;
      padding: 12px 14px;
      border-radius: 12px;
      outline: none;
    }
    input:focus {
      border-color: rgba(61,214,198,0.45);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }
    .btn {
      appearance: none;
      border: 1px solid rgba(61,214,198,0.4);
      background: var(--accent-dim);
      color: var(--accent);
      font: inherit;
      font-weight: 700;
      padding: 12px 18px;
      border-radius: 12px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s ease, transform 0.2s var(--ease);
    }
    .btn:hover { background: rgba(61, 214, 198, 0.28); transform: translateY(-1px); }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .btn.ghost {
      background: transparent;
      color: var(--ink);
      border-color: var(--line);
      font-weight: 600;
    }
    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cat-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .cat-row .pill.is-active {
      color: var(--accent);
      background: var(--accent-dim);
      border-color: rgba(61,214,198,0.35);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .pager .page-label {
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 600;
      min-width: 7rem;
      text-align: center;
    }
    .rail-block { display: grid; gap: 10px; margin-bottom: 22px; }
    .rail-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }
    .rail-head h2 {
      margin: 0;
      font-family: Syne, sans-serif;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .rail-head .hint-inline {
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 600;
    }
    .rail {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding: 2px 2px 10px;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
    }
    .rail::-webkit-scrollbar { height: 6px; }
    .rail::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.12);
      border-radius: 999px;
    }
    .rail .card {
      flex: 0 0 138px;
      scroll-snap-align: start;
      width: 138px;
    }
    @media (max-width: 560px) {
      .rail .card { flex-basis: 120px; width: 120px; }
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .crumbs strong { color: var(--ink); font-weight: 600; }
    .status { color: var(--muted); font-size: 0.88rem; min-height: 1.2em; }
    .status.is-err { color: var(--danger); }
    .key-panel {
      display: none;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid var(--line);
    }
    .key-panel.is-open { display: grid; }
    .hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.4;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 14px;
    }
    .card {
      appearance: none;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.025);
      border-radius: 14px;
      overflow: hidden;
      cursor: pointer;
      text-align: left;
      color: inherit;
      padding: 0;
      display: grid;
      transition: transform 0.22s var(--ease), border-color 0.2s ease, box-shadow 0.22s ease;
    }
    .card:hover, .card:focus-visible {
      transform: translateY(-5px) scale(1.01);
      border-color: rgba(61,214,198,0.5);
      box-shadow: 0 20px 44px rgba(0,0,0,0.45), 0 0 0 1px rgba(61,214,198,0.15);
      outline: none;
    }
    .card:hover .meta .title {
      color: var(--accent);
    }
    .poster {
      aspect-ratio: 3 / 4.2;
      width: 100%;
      object-fit: cover;
      background:
        linear-gradient(145deg, rgba(61,214,198,0.1), transparent 45%),
        #10141d;
      display: block;
    }
    .poster.ph {
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .meta { padding: 11px 12px 13px; display: grid; gap: 5px; }
    .meta .title {
      font-size: 0.9rem;
      font-weight: 650;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      transition: color 0.2s ease;
    }
    .meta .sub { color: var(--muted); font-size: 0.74rem; }
    .tick {
      display: inline-flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .tick span {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(255,255,255,0.06);
      color: var(--muted);
    }
    .tick .sub { color: var(--accent); background: var(--accent-dim); }

    /* Watchlist heart button on cards */
    .card { position: relative; }
    .wl-btn {
      position: absolute; top: 6px; right: 6px;
      appearance: none; border: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
      color: rgba(255,255,255,0.6); border-radius: 50%; width: 28px; height: 28px;
      font-size: 0.85rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s ease, color 0.15s ease, transform 0.15s ease;
      z-index: 2;
    }
    .card:hover .wl-btn, .card:focus-within .wl-btn, .wl-btn.is-wl { opacity: 1; }
    .wl-btn.is-wl { color: #ff5f7e; }
    .wl-btn:hover { transform: scale(1.15); }

    /* Continue watching progress bar */
    .cw-card { text-decoration: none; display: grid; border-radius: 14px; overflow: hidden; }
    .cw-card-wrap { position: relative; border-radius: 14px; overflow: hidden; cursor: pointer; }
    .cw-remove-btn {
      position: absolute; top: 5px; left: 5px;
      appearance: none; border: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
      color: rgba(255,255,255,0.75); border-radius: 50%; width: 24px; height: 24px;
      font-size: 0.7rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s ease, background 0.15s ease;
      z-index: 3;
    }
    .cw-card-wrap:hover .cw-remove-btn { opacity: 1; }
    .cw-remove-btn:hover { background: rgba(220, 60, 60, 0.8); color: #fff; }
    .cw-prog-bar {
      height: 3px; background: rgba(255,255,255,0.12); margin: 0;
    }
    .cw-prog-fill {
      height: 100%; background: var(--accent); border-radius: 0 2px 2px 0;
      transition: width 0.2s ease;
    }

    /* Mobile search: hidden dock, floating search button */
    .search-fab {
      display: none;
    }
    .search-overlay {
      display: none;
      position: fixed; inset: 0; z-index: 100;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      align-items: flex-start; justify-content: center;
      padding: 16px;
      padding-top: max(env(safe-area-inset-top, 16px), 16px);
    }
    .search-overlay.is-open { display: flex; }
    .search-overlay-inner {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      width: 100%;
      max-width: 480px;
      display: grid;
      gap: 12px;
    }
    .search-overlay-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .search-overlay-head h2 {
      margin: 0; font-size: 1rem; font-family: Syne, sans-serif; letter-spacing: -0.02em;
    }
    .search-overlay-close {
      appearance: none; border: 0; background: rgba(255,255,255,0.08);
      color: var(--ink); border-radius: 50%; width: 32px; height: 32px;
      font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    @media (max-width: 640px) {
      .search-dock { display: none !important; }
      .search-fab {
        display: flex;
        position: fixed; bottom: 20px; right: 16px; z-index: 50;
        appearance: none; border: 1px solid rgba(61,214,198,0.5);
        background: var(--panel);
        backdrop-filter: blur(12px);
        color: var(--accent);
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        font-weight: 700;
        font-size: 0.9rem;
        gap: 8px;
        align-items: center;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        transition: transform 0.2s var(--ease), box-shadow 0.2s ease;
      }
      .search-fab:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.55); }
      /* Show category pills inline at top of main on mobile instead */
      .mobile-cat-bar {
        display: flex; gap: 6px; overflow-x: auto; padding: 4px 0 8px;
        scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
      }
      .mobile-cat-bar::-webkit-scrollbar { display: none; }
      .mobile-cat-bar .pill { flex: 0 0 auto; scroll-snap-align: start; font-size: 0.8rem; padding: 7px 12px; }
      .mobile-key-section {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mobile-key-section.key-set::before {
        content: '✓ API key saved';
        font-size: 0.78rem;
        color: var(--accent);
        font-weight: 600;
      }
    }
    .detail {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 18px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255,255,255,0.03);
      margin-bottom: 14px;
    }
    .detail .poster {
      aspect-ratio: 3 / 4.2;
      width: 100%;
      border-radius: 12px;
      overflow: hidden;
    }
    .detail-body { display: grid; gap: 10px; align-content: start; min-width: 0; }
    .detail-body h2 {
      margin: 0;
      font-family: Syne, sans-serif;
      font-size: clamp(1.2rem, 2.4vw, 1.55rem);
      letter-spacing: -0.03em;
      line-height: 1.2;
    }
    .detail-alt { margin: 0; color: var(--muted); font-size: 0.88rem; }
    .detail-stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
    }
    .stat {
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(0,0,0,0.28);
      border: 1px solid var(--line);
    }
    .stat .k {
      display: block;
      color: var(--muted);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .stat .v { font-size: 0.86rem; font-weight: 600; }
    .synopsis {
      margin: 0;
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.55;
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .synopsis.expanded {
      display: block;
      -webkit-line-clamp: unset;
    }
    .syn-toggle {
      appearance: none;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      font-size: 0.82rem;
      font-weight: 650;
      padding: 0;
      cursor: pointer;
      width: fit-content;
    }
    .section-label {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .ep-toolbar {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .ep-toolbar .section-label { margin: 0; }
    .season-field { min-width: min(100%, 280px); flex: 1; }
    .season-field select {
      width: 100%;
      appearance: none;
      border: 1px solid var(--line);
      background:
        linear-gradient(45deg, transparent 50%, var(--muted) 50%) calc(100% - 18px) calc(50% - 3px) / 6px 6px no-repeat,
        linear-gradient(135deg, var(--muted) 50%, transparent 50%) calc(100% - 12px) calc(50% - 3px) / 6px 6px no-repeat,
        rgba(0,0,0,0.32);
      color: var(--ink);
      font: inherit;
      font-weight: 600;
      padding: 10px 36px 10px 12px;
      border-radius: 12px;
      outline: none;
      cursor: pointer;
    }
    .season-field select:focus {
      border-color: rgba(61,214,198,0.45);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }
    @media (max-width: 640px) {
      .detail { grid-template-columns: 96px 1fr; gap: 12px; padding: 12px; }
      .detail-stats { grid-template-columns: repeat(2, 1fr); }
    }
    .ep-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .ep-card {
      appearance: none;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.03);
      border-radius: 14px;
      overflow: hidden;
      cursor: pointer;
      text-align: left;
      color: inherit;
      padding: 0;
      display: grid;
      grid-template-columns: 72px 1fr;
      transition: border-color 0.2s ease, transform 0.2s var(--ease);
    }
    .ep-card:hover {
      border-color: rgba(61,214,198,0.45);
      transform: translateY(-2px);
    }
    .ep-card .poster {
      aspect-ratio: auto;
      width: 72px;
      height: 100%;
      min-height: 88px;
    }
    .ep-card .meta { padding: 10px 12px; align-content: center; }
    .badge {
      display: inline-block;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #ffb454;
      background: rgba(255,180,84,0.12);
      padding: 2px 6px;
      border-radius: 6px;
      margin-left: 6px;
    }
    .empty {
      padding: 56px 20px;
      text-align: center;
      color: var(--muted);
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      background: rgba(255,255,255,0.015);
    }
    .empty h2 {
      margin: 0 0 8px;
      font-family: Syne, sans-serif;
      font-size: 1.2rem;
      color: var(--ink);
    }
    .empty p { margin: 0 auto; max-width: 28rem; line-height: 1.5; }
    .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 14px; }
    .skel {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.03);
    }
    .skel .ph {
      aspect-ratio: 3/4.2;
      background: linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03));
      background-size: 200% 100%;
      animation: shimmer 1.2s linear infinite;
    }
    .skel .line {
      height: 12px;
      margin: 12px;
      border-radius: 6px;
      background: rgba(255,255,255,0.06);
    }
    @keyframes shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
    footer { color: var(--muted); font-size: 0.8rem; }
    /* Tablet / large phone */
    @media (max-width: 640px) {
      .page { padding: clamp(12px, 3vw, 20px); gap: 14px; }
      .pill { padding: 9px 14px; font-size: 0.84rem; min-height: 40px; }
      .btn { padding: 12px 16px; }
      .grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
      .skeleton-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
      .rail .card { flex-basis: 116px; width: 116px; }
      input[type="search"], input[type="password"], input[type="text"] { padding: 13px 14px; font-size: 1rem; }
    }
    /* Small phone: 375–480px */
    @media (max-width: 480px) {
      .grid { grid-template-columns: repeat(3, 1fr); gap: 9px; }
      .skeleton-grid { grid-template-columns: repeat(3, 1fr); gap: 9px; }
      .meta .title { font-size: 0.83rem; }
      .meta { padding: 8px 9px 10px; gap: 4px; }
      .search-dock { padding: 12px; gap: 10px; }
      .detail { grid-template-columns: 88px 1fr; gap: 12px; padding: 12px; }
      .detail-body h2 { font-size: 1.15rem; }
      .ep-grid { grid-template-columns: 1fr; }
      .ep-card { grid-template-columns: 64px 1fr; }
      .rail .card { flex-basis: 104px; width: 104px; }
    }
    /* Very small: 320px phones */
    @media (max-width: 360px) {
      .grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .skeleton-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .detail { grid-template-columns: 72px 1fr; gap: 8px; padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="brand-wrap">
        <h1 class="brand"><a href="/">ani<span>.</span>watch</a></h1>
        <p class="byline">by <em>wab</em></p>
      </div>
      <div class="nav">
        <a class="pill" href="/">Home</a>
        <button type="button" class="pill is-active" id="browseTab">Browse</button>
        <button type="button" class="pill" id="keyToggle">API key</button>
      </div>
    </header>

    <div class="search-dock">
      <div>
        <label class="field-label" for="q">Search anime</label>
        <div class="search-row">
          <input id="q" type="search" placeholder="One Piece, Citrus, Jujutsu Kaisen…" autocomplete="off" />
          <button type="button" class="btn" id="searchBtn">Search</button>
        </div>
      </div>
      <div class="key-panel" id="keyPanel">
        <label class="field-label" for="apiKey">x-api-key (this browser tab only)</label>
        <div class="search-row">
          <input id="apiKey" type="password" autocomplete="off" placeholder="BOT_SECRET_KEY" />
          <button type="button" class="btn ghost" id="saveKey">Save</button>
        </div>
        <p class="hint">Kept in sessionStorage — cleared when you close the tab. Only sent as <code>x-api-key</code> to this site.</p>
      </div>
      <div>
        <label class="field-label">Browse</label>
        <div class="cat-row" id="catRow" role="tablist" aria-label="Browse categories">
          <button type="button" class="pill is-active" data-cat="discover" data-label="Discover">Discover</button>
          <button type="button" class="pill" data-cat="recently-updated" data-label="Recently updated">Updated</button>
          <button type="button" class="pill" data-cat="recently-added" data-label="Recently added">New</button>
          <button type="button" class="pill" data-cat="top-airing" data-label="Top airing">Airing</button>
          <button type="button" class="pill" data-cat="most-popular" data-label="Most popular">Popular</button>
          <button type="button" class="pill" data-cat="most-favorite" data-label="Most favorite">Favorite</button>
          <button type="button" class="pill" data-cat="top-upcoming" data-label="Top upcoming">Upcoming</button>
          <button type="button" class="pill" data-cat="movie" data-label="Movies">Movies</button>
          <button type="button" class="pill" data-cat="tv" data-label="TV series">TV</button>
          <button type="button" class="pill" data-cat="completed" data-label="Completed">Completed</button>
        </div>
      </div>
      <div class="meta-row">
        <div class="crumbs" id="crumbs"><span>Discover loads with your API key</span></div>
        <p class="status" id="status"></p>
      </div>
    </div>

    <main id="main">
      <div class="empty">
        <h2>Discover &amp; browse</h2>
        <p>Enter your API key once to load Trending, Latest episodes, and category pages — or search any title. Open an episode to launch the player.</p>
      </div>
    </main>

    <footer>${SITE_NAME} · ${SITE_TAGLINE} · watch opens in a new tab<br />${NOTICE_SHORT}</footer>
  </div>

  <!-- Mobile search overlay (hidden on desktop via CSS) -->
  <div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Search anime">
    <div class="search-overlay-inner">
      <div class="search-overlay-head">
        <h2>Search</h2>
        <button type="button" class="search-overlay-close" id="searchOverlayClose" aria-label="Close search">✕</button>
      </div>
      <div>
        <div class="search-row" style="grid-template-columns: 1fr auto">
          <input id="qMobile" type="search" placeholder="One Piece, Citrus…" autocomplete="off" />
          <button type="button" class="btn" id="searchBtnMobile">Go</button>
        </div>
      </div>
      <div class="mobile-key-section" id="mobileKeySection">
        <label class="field-label" for="apiKeyMobile">API Key</label>
        <div class="search-row" style="grid-template-columns: 1fr auto">
          <input id="apiKeyMobile" type="password" autocomplete="off" placeholder="BOT_SECRET_KEY" />
          <button type="button" class="btn ghost" id="saveKeyMobile">Save</button>
        </div>
        <p class="hint">Kept in sessionStorage — cleared when you close the tab.</p>
      </div>
    </div>
  </div>

  <!-- Mobile floating search button -->
  <button type="button" class="search-fab" id="searchFab" aria-label="Open search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
    Search
  </button>

  <script>
    (function () {
      var KEY = 'ani.apiKey';
      var RAIL_CAP = 18;
      var apiKey = document.getElementById('apiKey');
      var q = document.getElementById('q');
      var searchBtn = document.getElementById('searchBtn');
      var saveKey = document.getElementById('saveKey');
      var keyToggle = document.getElementById('keyToggle');
      var keyPanel = document.getElementById('keyPanel');
      var apiKeyMobile = document.getElementById('apiKeyMobile');
      var saveKeyMobile = document.getElementById('saveKeyMobile');
      var mobileKeySection = document.getElementById('mobileKeySection');
      var catRow = document.getElementById('catRow');
      var main = document.getElementById('main');
      var statusEl = document.getElementById('status');
      var crumbs = document.getElementById('crumbs');
      var state = {
        view: 'discover',
        anime: null,
        lastAnimes: [],
        source: 'discover',
        listQuery: null,
        listLabel: 'Discover',
        listPage: 1,
        pageInfo: null,
        home: null,
      };
      var POSTER_PROXY_BASE = ${JSON.stringify(posterProxy)};
      var POSTER_PROXY_KEY = ${JSON.stringify(posterKey)};

      try { localStorage.removeItem(KEY); } catch (e) {}
      apiKey.value = sessionStorage.getItem(KEY) || '';
      apiKeyMobile.value = apiKey.value;
      if (apiKey.value.trim()) mobileKeySection.classList.add('key-set');
      if (!apiKey.value.trim()) keyPanel.classList.add('is-open');

      function persistKey() {
        var v = apiKey.value.trim() || apiKeyMobile.value.trim();
        apiKey.value = v;
        apiKeyMobile.value = v;
        if (v) { sessionStorage.setItem(KEY, v); mobileKeySection.classList.add('key-set'); }
        else { sessionStorage.removeItem(KEY); mobileKeySection.classList.remove('key-set'); }
      }
      apiKey.addEventListener('change', persistKey);
      apiKey.addEventListener('blur', persistKey);
      apiKeyMobile.addEventListener('change', persistKey);
      apiKeyMobile.addEventListener('blur', persistKey);
      saveKey.addEventListener('click', function () {
        persistKey();
        setStatus(apiKey.value.trim() ? 'API key saved for this tab' : 'API key cleared');
        keyPanel.classList.remove('is-open');
        if (apiKey.value.trim()) loadDiscover();
      });
      saveKeyMobile.addEventListener('click', function () {
        persistKey();
        searchOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (apiKey.value.trim()) { setStatus('API key saved'); loadDiscover(); }
        else setStatus('API key cleared');
      });
      keyToggle.addEventListener('click', function () {
        if (window.innerWidth <= 640) {
          // On mobile: open the search overlay (which contains the API key section)
          searchOverlay.classList.add('is-open');
          document.body.style.overflow = 'hidden';
          apiKeyMobile.value = apiKey.value;
          setTimeout(function () { mobileKeySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 120);
        } else {
          keyPanel.classList.toggle('is-open');
        }
      });

      function setStatus(msg, isErr) {
        statusEl.textContent = msg || '';
        statusEl.classList.toggle('is-err', !!isErr);
      }

      function requireKey(action) {
        if (apiKey.value.trim()) return true;
        keyPanel.classList.add('is-open');
        setStatus('API key required' + (action ? ' for ' + action : '') + '.', true);
        return false;
      }

      function setActiveCat(query) {
        catRow.querySelectorAll('[data-cat]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-cat') === query);
        });
      }

      var FETCH_MS = 20000;
      var loadSeq = 0;

      function headers() {
        var h = { Accept: 'application/json' };
        var key = apiKey.value.trim();
        if (key) h['x-api-key'] = key;
        return h;
      }

      async function getJson(path, ms) {
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = null;
        try {
          if (ctrl) {
            timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || FETCH_MS);
          }
          var res = await fetch(path, { headers: headers(), signal: ctrl ? ctrl.signal : undefined });
          var text = await res.text();
          var json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) {}
          if (res.status === 401 || res.status === 403) {
            keyPanel.classList.add('is-open');
            throw new Error('Unauthorized — set your API key.');
          }
          if (!res.ok) {
            throw new Error((json && (json.message || json.error)) || ('Request failed (' + res.status + ')'));
          }
          if (json && json.success === false) {
            throw new Error(json.message || 'Request failed');
          }
          return json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
        } catch (err) {
          if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
            throw new Error('Request timed out — try again.');
          }
          throw err;
        } finally {
          if (timer) clearTimeout(timer);
        }
      }

      function esc(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function normalizeAnime(a) {
        if (!a) return null;
        return {
          id: a.id,
          name: a.name || a.title || a.id,
          jname: a.jname || a.alternativeTitle || null,
          poster: a.poster || null,
          duration: a.duration || null,
          type: a.type || null,
          episodes: a.episodes || {},
          rank: a.rank || null,
        };
      }

      function takeList(arr, cap) {
        return (arr || []).map(normalizeAnime).filter(function (a) { return a && a.id; }).slice(0, cap || RAIL_CAP);
      }

      /** Normalize to absolute http(s) URL. */
      function absUrl(url) {
        if (!url) return null;
        var s = String(url).trim();
        if (!s || s.indexOf('data:') === 0) return null;
        if (s.indexOf('https://') === 0 || s.indexOf('http://') === 0) return s;
        if (s.indexOf('//') === 0) return 'https:' + s;
        return null;
      }

      function canHotlinkDirect(abs) {
        return abs.indexOf('anipixcdn.co') !== -1;
      }

      function viaPosterProxy(abs) {
        var u = POSTER_PROXY_BASE + '?url=' + encodeURIComponent(abs);
        if (POSTER_PROXY_KEY) u += '&k=' + encodeURIComponent(POSTER_PROXY_KEY);
        return u;
      }

      /**
       * Prefer direct CDN (fast) when hotlink-safe; proxy only as fallback.
       * Dedupes so episode grids sharing one anime poster hit the network once.
       */
      function posterCandidates(list) {
        var seen = {};
        var direct = [];
        var proxied = [];
        (list || []).forEach(function (url) {
          var abs = absUrl(url);
          if (!abs || seen['u:' + abs]) return;
          seen['u:' + abs] = 1;
          var viaProxy = viaPosterProxy(abs);
          if (canHotlinkDirect(abs)) {
            direct.push(abs);
            proxied.push(viaProxy);
          } else {
            proxied.push(viaProxy);
            direct.push(abs);
          }
        });
        return direct.concat(proxied).filter(function (u, i, arr) {
          return arr.indexOf(u) === i;
        });
      }

      window.__aniPosterFail = function (img) {
        try {
          var list = [];
          try { list = JSON.parse(img.getAttribute('data-fallbacks') || '[]'); } catch (e) {}
          while (list.length) {
            var next = list.shift();
            img.setAttribute('data-fallbacks', JSON.stringify(list));
            if (next && next !== img.getAttribute('src')) {
              img.src = next;
              return;
            }
          }
          var ph = document.createElement('div');
          ph.className = 'poster ph';
          ph.setAttribute('aria-hidden', 'true');
          ph.textContent = 'No art';
          if (img.parentNode) img.parentNode.replaceChild(ph, img);
        } catch (e) {
          // never let image errors bubble
        }
      };

      function posterImg(urls, alt) {
        var unique = posterCandidates(Array.isArray(urls) ? urls : [urls]);
        if (!unique.length) {
          return '<div class="poster ph" aria-hidden="true">No art</div>';
        }
        var first = unique[0];
        var rest = unique.slice(1);
        return (
          '<img class="poster" src="' + esc(first) + '" alt="' + esc(alt || '') +
          '" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallbacks="' +
          esc(JSON.stringify(rest)) +
          '" onerror="window.__aniPosterFail&&window.__aniPosterFail(this)" />'
        );
      }

      function backCrumb() {
        if (state.source === 'list') {
          return { label: state.listLabel || 'Browse', action: 'list' };
        }
        if (state.source === 'search') {
          return { label: 'Results', action: 'search' };
        }
        return { label: 'Discover', action: 'discover' };
      }

      function setCrumbs(parts) {
        crumbs.innerHTML = parts.map(function (p) {
          if (p.action) {
            return '<button type="button" class="pill" data-crumb="' + esc(p.action) + '">' + esc(p.label) + '</button>';
          }
          return '<strong>' + esc(p.label) + '</strong>';
        }).join('<span aria-hidden="true">/</span>');
        crumbs.querySelectorAll('[data-crumb]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var action = btn.getAttribute('data-crumb');
            if (action === 'search') renderSearch(state.lastAnimes || []);
            else if (action === 'list') renderList(state.lastAnimes || [], state.pageInfo);
            else if (action === 'discover') {
              setActiveCat('discover');
              if (state.home) renderDiscover(state.home);
              else loadDiscover();
            }
          });
        });
      }

      function showSkeleton(n) {
        var html = '<div class="skeleton-grid">';
        for (var i = 0; i < n; i++) {
          html += '<div class="skel"><div class="ph"></div><div class="line"></div><div class="line" style="width:55%"></div></div>';
        }
        main.innerHTML = html + '</div>';
      }

      // ── Watchlist ──────────────────────────────────────────────────────────
      var WL_KEY = 'ani.watchlist';
      function readWatchlist() {
        try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch (e) { return []; }
      }
      function isInWatchlist(id) {
        return readWatchlist().some(function (x) { return x.id === id; });
      }
      function toggleWatchlist(a, heartBtn) {
        var list = readWatchlist();
        var idx = list.findIndex(function (x) { return x.id === a.id; });
        if (idx >= 0) {
          list.splice(idx, 1);
        } else {
          list.unshift({ id: a.id, name: a.name, poster: Array.isArray(a.poster) ? a.poster[0] : a.poster });
          if (list.length > 200) list = list.slice(0, 200);
        }
        try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch (e) {}
        var inWl = idx < 0; // we just added it
        heartBtn.textContent = inWl ? '♥' : '♡';
        heartBtn.classList.toggle('is-wl', inWl);
        heartBtn.setAttribute('aria-label', inWl ? 'Remove from watchlist' : 'Add to watchlist');
      }

      // ── Continue watching ──────────────────────────────────────────────────
      var CW_KEY = 'ani.cw';
      function readCw() {
        try { return JSON.parse(localStorage.getItem(CW_KEY) || '[]'); } catch (e) { return []; }
      }
      function cwRemove(id) {
        try {
          var list = readCw().filter(function (x) { return x.id !== id; });
          localStorage.setItem(CW_KEY, JSON.stringify(list));
        } catch (e) {}
      }
      function renderCwRail() {
        var list = readCw();
        if (!list.length) return null;
        var wrap = document.createElement('section');
        wrap.className = 'rail-block';
        wrap.innerHTML =
          '<div class="rail-head"><h2>Continue Watching</h2>' +
          '<span class="hint-inline">Pick up where you left off</span></div>' +
          '<div class="rail cw-rail"></div>';
        var rail = wrap.querySelector('.rail');
        list.slice(0, 12).forEach(function (entry) {
          // Try to get poster from stored anime meta (written by browse before opening player)
          var posterStr = entry.poster || null;
          if (!posterStr && entry.id) {
            try {
              var meta = JSON.parse(localStorage.getItem('ani.meta.' + entry.id) || 'null');
              if (meta && meta.poster) posterStr = meta.poster;
            } catch (e) {}
          }
          var pct = (entry.dur && entry.dur > 0) ? Math.round(entry.t / entry.dur * 100) : 0;
          var posterUrls = posterStr ? [posterStr] : [];
          var card = document.createElement('div');
          card.className = 'card cw-card-wrap';
          card.style.position = 'relative';
          var link = document.createElement('a');
          link.className = 'card cw-card';
          link.href = entry.href || '#';
          link.style.border = 'none';
          link.style.borderRadius = '0';
          link.innerHTML =
            posterImg(posterUrls, entry.name) +
            '<div class="cw-prog-bar"><div class="cw-prog-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="meta"><div class="title">' + esc(entry.name || entry.id) + '</div>' +
            '<div class="tick"><span>EP ' + esc(String(entry.epNum || '?')) + '</span></div></div>';
          var removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'cw-remove-btn';
          removeBtn.setAttribute('aria-label', 'Remove from continue watching');
          removeBtn.title = 'Remove';
          removeBtn.textContent = '✕';
          removeBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            cwRemove(entry.id);
            card.remove();
            // Hide the whole rail if empty
            if (!rail.children.length) {
              wrap.remove();
            }
          });
          card.appendChild(link);
          card.appendChild(removeBtn);
          rail.appendChild(card);
        });
        return wrap;
      }
      function renderWatchlistRail() {
        var list = readWatchlist();
        if (!list.length) return null;
        var items = list.slice(0, 18).map(function (x) {
          return { id: x.id, name: x.name, poster: x.poster ? [x.poster] : [], episodes: {} };
        });
        return renderRail('My Watchlist', items, 'Your saved titles');
      }

      function animeCard(a) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card';
        var eps = a.episodes || {};
        var ticks = '';
        if (a.rank != null) ticks += '<span>#' + esc(a.rank) + '</span>';
        if (a.type) ticks += '<span>' + esc(a.type) + '</span>';
        if (eps.sub != null) ticks += '<span class="sub">SUB ' + esc(eps.sub) + '</span>';
        if (eps.dub != null) ticks += '<span>DUB ' + esc(eps.dub) + '</span>';
        if (eps.eps != null && eps.sub == null && eps.dub == null) {
          ticks += '<span>EP ' + esc(eps.eps) + '</span>';
        }
        var inWl = isInWatchlist(a.id);
        btn.innerHTML =
          posterImg(a.poster, a.name) +
          '<div class="meta"><div class="title">' + esc(a.name || a.id) + '</div>' +
          '<div class="tick">' + ticks + '</div></div>' +
          '<button type="button" class="wl-btn' + (inWl ? ' is-wl' : '') + '" aria-label="' + (inWl ? 'Remove from watchlist' : 'Add to watchlist') + '" data-wl-id="' + esc(a.id) + '" title="Watchlist">' +
          (inWl ? '♥' : '♡') + '</button>';
        btn.addEventListener('click', function () { loadEpisodes(a); });
        // Watchlist heart click (stop propagation so card click doesn't fire)
        btn.querySelector('.wl-btn').addEventListener('click', function (e) {
          e.stopPropagation();
          toggleWatchlist(a, this);
        });
        return btn;
      }

      function fillGrid(grid, animes) {
        animes.forEach(function (a) { grid.appendChild(animeCard(a)); });
      }

      function renderRail(title, items, hint) {
        if (!items || !items.length) return '';
        var wrap = document.createElement('section');
        wrap.className = 'rail-block';
        wrap.innerHTML =
          '<div class="rail-head"><h2>' + esc(title) + '</h2>' +
          (hint ? '<span class="hint-inline">' + esc(hint) + '</span>' : '') +
          '</div><div class="rail"></div>';
        var rail = wrap.querySelector('.rail');
        fillGrid(rail, items);
        return wrap;
      }

      function renderMobileCatBar(activeCat) {
        var cats = [
          { q: 'discover', label: 'Discover' },
          { q: 'recently-updated', label: 'Updated' },
          { q: 'recently-added', label: 'New' },
          { q: 'top-airing', label: 'Airing' },
          { q: 'most-popular', label: 'Popular' },
          { q: 'most-favorite', label: 'Favorite' },
          { q: 'top-upcoming', label: 'Upcoming' },
          { q: 'movie', label: 'Movies' },
          { q: 'tv', label: 'TV' },
          { q: 'completed', label: 'Completed' },
        ];
        var bar = document.createElement('div');
        bar.className = 'mobile-cat-bar';
        cats.forEach(function (c) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pill' + (c.q === activeCat ? ' is-active' : '');
          btn.textContent = c.label;
          btn.addEventListener('click', function () {
            if (c.q === 'discover') loadDiscover();
            else loadList(c.q, c.label, 1);
          });
          bar.appendChild(btn);
        });
        return bar;
      }

      function renderDiscover(home) {
        state.view = 'discover';
        state.source = 'discover';
        state.anime = null;
        state.home = home;
        state.listQuery = null;
        setActiveCat('discover');
        setCrumbs([{ label: 'Discover' }]);
        main.innerHTML = '';
        var rails = [
          renderCwRail(),
          renderWatchlistRail(),
          renderRail('Trending', takeList(home.trending), 'Hot now'),
          renderRail('Latest episodes', takeList(home.latestEpisode), 'Just dropped'),
          renderRail('Newly added', takeList(home.newAdded), 'Fresh titles'),
          renderRail('Top airing', takeList(home.topAiring)),
          renderRail('Most popular', takeList(home.mostPopular)),
        ].filter(Boolean);
        if (!rails.length) {
          main.innerHTML = '<div class="empty"><h2>Nothing to show</h2><p>Home catalog came back empty. Try a category or search.</p></div>';
          return;
        }
        rails.forEach(function (el) { main.appendChild(el); });
        // Mobile: prepend category scrollbar (search dock is hidden on mobile)
        main.insertBefore(renderMobileCatBar('discover'), main.firstChild);
      }

      function renderList(animes, pageInfo) {
        state.view = 'list';
        state.source = 'list';
        state.anime = null;
        state.lastAnimes = animes;
        state.pageInfo = pageInfo || null;
        setActiveCat(state.listQuery || 'discover');
        var page = (pageInfo && pageInfo.currentPage) || state.listPage || 1;
        var total = (pageInfo && pageInfo.totalPages) || null;
        setCrumbs([
          { label: 'Discover', action: 'discover' },
          { label: (state.listLabel || 'Browse') + (total ? ' · p.' + page : '') },
        ]);
        if (!animes.length) {
          main.innerHTML = '<div class="empty"><h2>No titles</h2><p>This category has nothing on this page.</p></div>';
          return;
        }
        main.innerHTML = '<div class="grid" id="animeGrid"></div><div class="pager" id="pager"></div>';
        fillGrid(document.getElementById('animeGrid'), animes);
        // Mobile category bar above grid
        main.insertBefore(renderMobileCatBar(state.listQuery || null), main.firstChild);
        var pager = document.getElementById('pager');
        var hasPrev = page > 1;
        var hasNext = pageInfo ? !!pageInfo.hasNextPage : false;
        if (!hasPrev && !hasNext) {
          pager.innerHTML = '<span class="page-label">Page ' + page + (total ? ' / ' + total : '') + '</span>';
          return;
        }
        pager.innerHTML =
          '<button type="button" class="btn ghost" id="prevPage"' + (hasPrev ? '' : ' disabled') + '>Previous</button>' +
          '<span class="page-label">Page ' + page + (total ? ' / ' + total : '') + '</span>' +
          '<button type="button" class="btn ghost" id="nextPage"' + (hasNext ? '' : ' disabled') + '>Next</button>';
        var prev = document.getElementById('prevPage');
        var next = document.getElementById('nextPage');
        if (prev) prev.addEventListener('click', function () {
          if (page > 1) loadList(state.listQuery, state.listLabel, page - 1);
        });
        if (next) next.addEventListener('click', function () {
          if (hasNext) loadList(state.listQuery, state.listLabel, page + 1);
        });
      }

      function renderSearch(animes) {
        state.view = 'search';
        state.source = 'search';
        state.anime = null;
        state.lastAnimes = animes;
        setActiveCat(null);
        setCrumbs([
          { label: 'Discover', action: 'discover' },
          { label: animes.length + ' result' + (animes.length === 1 ? '' : 's') },
        ]);
        if (!animes.length) {
          main.innerHTML = '<div class="empty"><h2>No matches</h2><p>Try another spelling or a shorter keyword.</p></div>';
          return;
        }
        main.innerHTML = '<div class="grid" id="animeGrid"></div>';
        fillGrid(document.getElementById('animeGrid'), animes.map(normalizeAnime).filter(Boolean));
      }

      function renderEpisodes(anime, payload, detail) {
        state.view = 'episodes';
        state.anime = anime;
        var episodes = payload.episodes || [];
        var d = detail || {};
        // Prefer search poster (already shown on cards) over detail/episode fields.
        var poster =
          anime.poster ||
          payload.poster ||
          d.poster ||
          null;
        var posterFallbacks = [anime.poster, payload.poster, d.poster].filter(Boolean);
        var title = d.title || anime.name || anime.id;
        setCrumbs([
          backCrumb(),
          { label: title },
        ]);
        if (!episodes.length) {
          main.innerHTML = '<div class="empty"><h2>No episodes</h2><p>This title has no playable episode list right now.</p></div>';
          return;
        }

        var eps = d.episodes || anime.episodes || {};
        var ticks = '';
        if (d.type || anime.type) ticks += '<span>' + esc(d.type || anime.type) + '</span>';
        if (d.rating) ticks += '<span>' + esc(d.rating) + '</span>';
        if (d.is18Plus) ticks += '<span>18+</span>';
        if (eps.sub != null) ticks += '<span class="sub">SUB ' + esc(eps.sub) + '</span>';
        if (eps.dub != null) ticks += '<span>DUB ' + esc(eps.dub) + '</span>';
        (d.genres || []).slice(0, 6).forEach(function (g) {
          ticks += '<span>' + esc(g) + '</span>';
        });

        function stat(k, v) {
          if (v == null || v === '') return '';
          return '<div class="stat"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>';
        }

        var aired = '';
        if (d.aired && (d.aired.from || d.aired.to)) {
          aired = [d.aired.from, d.aired.to].filter(Boolean).join(' – ');
        }

        var synopsis = (d.synopsis || '').trim();
        var synHtml = '';
        if (synopsis) {
          synHtml =
            '<p class="synopsis" id="synopsis">' + esc(synopsis) + '</p>' +
            (synopsis.length > 220
              ? '<button type="button" class="syn-toggle" id="synToggle">Show more</button>'
              : '');
        }

        var seasons = (d.moreSeasons || []).filter(function (s) { return s && s.id; });
        if (seasons.length) {
          var hasCurrent = seasons.some(function (s) { return s.id === anime.id; });
          if (!hasCurrent && anime.id) {
            seasons = [{
              id: anime.id,
              title: title,
              alternativeTitle: 'Current',
              poster: poster,
              isActive: true,
            }].concat(seasons);
          }
        }

        var seasonBar = '';
        if (seasons.length > 1) {
          seasonBar =
            '<div class="season-field">' +
              '<label class="field-label" for="seasonSelect">Season</label>' +
              '<select id="seasonSelect">' +
              seasons.map(function (s) {
                var label = (s.alternativeTitle || s.title || s.id || '').trim();
                var selected = s.id === anime.id || s.isActive ? ' selected' : '';
                return '<option value="' + esc(s.id) + '"' + selected + '>' + esc(label) + '</option>';
              }).join('') +
              '</select>' +
            '</div>';
        }

        var detailHtml =
          '<section class="detail">' +
            posterImg(posterFallbacks, title) +
            '<div class="detail-body">' +
              '<h2>' + esc(title) + '</h2>' +
              (d.alternativeTitle || anime.jname
                ? '<p class="detail-alt">' + esc(d.alternativeTitle || anime.jname) + '</p>'
                : '') +
              '<div class="tick">' + ticks + '</div>' +
              '<div class="detail-stats">' +
                stat('Status', d.status) +
                stat('Score', d.MAL_score) +
                stat('Premiered', d.premiered) +
                stat('Aired', aired) +
                stat('Duration', d.duration || anime.duration) +
                stat('Episodes', payload.totalEpisodes || episodes.length) +
                stat('Studios', (d.studios || []).slice(0, 2).join(', ')) +
              '</div>' +
              synHtml +
            '</div>' +
          '</section>' +
          '<div class="ep-toolbar">' +
            '<p class="section-label">Episodes</p>' +
            seasonBar +
          '</div>' +
          '<div class="ep-grid" id="epGrid"></div>';

        main.innerHTML = detailHtml;

        var seasonSelect = document.getElementById('seasonSelect');
        if (seasonSelect) {
          seasonSelect.addEventListener('change', function () {
            var nextId = seasonSelect.value;
            if (!nextId || nextId === anime.id) return;
            var s = null;
            for (var i = 0; i < seasons.length; i++) {
              if (seasons[i].id === nextId) { s = seasons[i]; break; }
            }
            loadEpisodes({
              id: nextId,
              name: (s && (s.title || s.alternativeTitle)) || nextId,
              jname: s && s.alternativeTitle,
              poster: (s && s.poster) || poster || anime.poster || null,
            });
          });
        }

        var synToggle = document.getElementById('synToggle');
        var synEl = document.getElementById('synopsis');
        if (synToggle && synEl) {
          synToggle.addEventListener('click', function () {
            var open = synEl.classList.toggle('expanded');
            synToggle.textContent = open ? 'Show less' : 'Show more';
          });
        }

        var grid = document.getElementById('epGrid');
        episodes.forEach(function (ep) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ep-card';
          var num = ep.number;
          var raw = String(ep.title || ep.alternativeTitle || '').trim();
          // HiAnime often labels chips "Episode 12" — don't show that twice.
          var generic =
            !raw ||
            /^episode\s*#?\s*\d+$/i.test(raw) ||
            (num != null && raw === String(num));
          var epTag = num != null ? 'Ep ' + num : 'Episode';
          var primary = generic ? epTag : raw;
          var secondary = generic ? null : epTag;
          btn.innerHTML =
            posterImg(poster || posterFallbacks, primary) +
            '<div class="meta"><div class="title">' + esc(primary) +
            (ep.isFiller ? '<span class="badge">Filler</span>' : '') +
            '</div>' +
            (secondary ? '<div class="sub">' + esc(secondary) + '</div>' : '') +
            '</div>';
          btn.addEventListener('click', function () { playEpisode(ep); });
          grid.appendChild(btn);
        });
      }

      async function loadDiscover() {
        if (!requireKey('discover')) return;
        persistKey();
        var seq = ++loadSeq;
        setStatus('Loading discover…');
        showSkeleton(8);
        try {
          var data = await getJson('/api/v2/home');
          if (seq !== loadSeq) return;
          setStatus('Discover ready');
          renderDiscover(data || {});
        } catch (err) {
          if (seq !== loadSeq) return;
          setStatus((err && err.message) || 'Discover failed', true);
          main.innerHTML = '<div class="empty"><h2>Discover failed</h2><p>' + esc((err && err.message) || 'Try again shortly.') + '</p></div>';
        }
      }

      async function loadList(query, label, page) {
        if (!query || query === 'discover') {
          loadDiscover();
          return;
        }
        if (!requireKey('browse')) return;
        persistKey();
        var seq = ++loadSeq;
        state.listQuery = query;
        state.listLabel = label || query;
        state.listPage = page || 1;
        setActiveCat(query);
        setStatus('Loading ' + (label || query) + '…');
        showSkeleton(10);
        try {
          var path = '/api/v2/animes/' + encodeURIComponent(query) + '?page=' + encodeURIComponent(String(page || 1));
          var data = await getJson(path);
          if (seq !== loadSeq) return;
          var animes = takeList((data && data.response) || [], 48);
          var pageInfo = (data && data.pageInfo) || {
            currentPage: page || 1,
            hasNextPage: false,
            totalPages: 1,
          };
          setStatus((animes.length || 0) + ' titles · page ' + (pageInfo.currentPage || page || 1));
          renderList(animes, pageInfo);
        } catch (err) {
          if (seq !== loadSeq) return;
          setStatus((err && err.message) || 'Browse failed', true);
          main.innerHTML = '<div class="empty"><h2>Browse failed</h2><p>' + esc((err && err.message) || 'Try again shortly.') + '</p></div>';
        }
      }

      async function doSearch() {
        var keyword = q.value.trim();
        if (!keyword) {
          setStatus('Enter a search term.', true);
          return;
        }
        if (!requireKey('search')) return;
        persistKey();
        var seq = ++loadSeq;
        searchBtn.disabled = true;
        setStatus('Searching…');
        showSkeleton(10);
        try {
          var data = await getJson('/api/v2/hianime/search?keyword=' + encodeURIComponent(keyword));
          if (seq !== loadSeq) return;
          var animes = (data && (data.animes || data.response)) || [];
          setStatus(animes.length + ' result' + (animes.length === 1 ? '' : 's'));
          renderSearch(animes);
        } catch (err) {
          if (seq !== loadSeq) return;
          setStatus((err && err.message) || 'Search failed', true);
          main.innerHTML = '<div class="empty"><h2>Search failed</h2><p>' + esc((err && err.message) || 'Try again shortly.') + '</p></div>';
        } finally {
          if (seq === loadSeq) searchBtn.disabled = false;
        }
      }

      async function loadEpisodes(anime) {
        if (!anime || !anime.id) return;
        var seq = ++loadSeq;
        setStatus('Loading details…');
        showSkeleton(8);
        try {
          var id = encodeURIComponent(anime.id);
          var epPromise = getJson('/api/v2/hianime/anime/' + id + '/episodes');
          var detailPromise = getJson('/api/v2/anime/' + id).catch(function () { return null; });
          var data = await epPromise;
          if (seq !== loadSeq) return;
          if (!data || !Array.isArray(data.episodes)) {
            throw new Error('No episodes returned.');
          }
          // Don't block the episode list on slow detail metadata.
          var detail = null;
          try {
            detail = await Promise.race([
              detailPromise,
              new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 4000); }),
            ]);
          } catch (e) {
            detail = null;
          }
          if (seq !== loadSeq) return;
          setStatus((data.totalEpisodes || data.episodes.length) + ' episodes');
          renderEpisodes(anime, data, detail);
          // If detail arrived late, quietly refresh metadata once.
          detailPromise.then(function (late) {
            if (seq !== loadSeq || !late || detail) return;
            try { renderEpisodes(anime, data, late); } catch (e) {}
          }).catch(function () {});
        } catch (err) {
          if (seq !== loadSeq) return;
          setStatus((err && err.message) || 'Could not load episodes', true);
          main.innerHTML = '<div class="empty"><h2>Could not load episodes</h2><p>' + esc((err && err.message) || '') + '</p></div>';
        }
      }

      async function playEpisode(ep) {
        var episodeId = ep.episodeId || ep.id;
        if (!episodeId) {
          setStatus('Missing episode id.', true);
          return;
        }
        setStatus('Resolving stream…');
        try {
          var params = new URLSearchParams({
            animeEpisodeId: String(episodeId).replace('::', '?'),
            server: 'hd-1',
            category: 'sub',
          });
          var data = await getJson('/api/v2/hianime/episode/sources?' + params.toString(), 25000);
          var link =
            data.link ||
            (data.tracks && data.tracks.sub && data.tracks.sub.link) ||
            (data.sources && data.sources[0] && data.sources[0].url);
          if (!link) throw new Error('No watch link returned.');
          // Save anime metadata so the watch page can store the poster in CW entries
          if (state.anime && state.anime.id) {
            try {
              var posterVal = state.anime.poster;
              var posterStr = Array.isArray(posterVal) ? posterVal[0] : (posterVal || null);
              localStorage.setItem(
                'ani.meta.' + state.anime.id,
                JSON.stringify({ id: state.anime.id, name: state.anime.name || state.anime.id, poster: posterStr })
              );
            } catch (e) {}
          }
          setStatus('Opening player…');
          window.open(link, '_blank', 'noopener');
        } catch (err) {
          setStatus((err && err.message) || 'Could not resolve stream', true);
        }
      }

      window.addEventListener('unhandledrejection', function (ev) {
        try { ev.preventDefault(); } catch (e) {}
      });

      catRow.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-cat]') : null;
        if (!btn) return;
        var query = btn.getAttribute('data-cat');
        var label = btn.getAttribute('data-label') || query;
        if (query === 'discover') loadDiscover();
        else loadList(query, label, 1);
      });

      searchBtn.addEventListener('click', doSearch);
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doSearch();
      });

      // Mobile search FAB + overlay
      var searchFab = document.getElementById('searchFab');
      var searchOverlay = document.getElementById('searchOverlay');
      var searchOverlayClose = document.getElementById('searchOverlayClose');
      var qMobile = document.getElementById('qMobile');
      var searchBtnMobile = document.getElementById('searchBtnMobile');
      function openSearchOverlay() {
        searchOverlay.classList.add('is-open');
        apiKeyMobile.value = apiKey.value;
        if (apiKey.value.trim()) mobileKeySection.classList.add('key-set');
        setTimeout(function () { if (qMobile) qMobile.focus(); }, 80);
      }
      function closeSearchOverlay() {
        searchOverlay.classList.remove('is-open');
      }
      if (searchFab) searchFab.addEventListener('click', openSearchOverlay);
      if (searchOverlayClose) searchOverlayClose.addEventListener('click', closeSearchOverlay);
      if (searchOverlay) {
        searchOverlay.addEventListener('click', function (e) {
          if (e.target === searchOverlay) closeSearchOverlay();
        });
      }
      async function doMobileSearch() {
        var keyword = (qMobile && qMobile.value.trim()) || '';
        if (!keyword) return;
        // Sync to desktop input
        q.value = keyword;
        closeSearchOverlay();
        await doSearch();
      }
      if (searchBtnMobile) searchBtnMobile.addEventListener('click', doMobileSearch);
      if (qMobile) {
        qMobile.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') doMobileSearch();
        });
      }

      if (apiKey.value.trim()) loadDiscover();
      else q.focus();
    })();
  </script>
  ${vercelObservabilityScriptTags()}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
    },
  });
};

export default browseController;


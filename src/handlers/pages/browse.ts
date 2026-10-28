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
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
  <noscript><link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" /></noscript>
  <style>
    :root {
      --bg0: #07090d;
      --ink: #e8edf5;
      --muted: #8b95a8;
      --accent: #3dd6c6;
      --accent-dim: rgba(61, 214, 198, 0.16);
      --danger: #ff7b72;
      --warning: #ffb454;
      --warning-dim: rgba(255, 180, 84, 0.12);
      --line: rgba(255, 255, 255, 0.1);
      --panel: rgba(12, 16, 24, 0.88);
      --radius-sm: 6px;
      --radius-md: 12px;
      --radius-lg: 14px;
      --radius-xl: 18px;
      --radius-pill: 999px;
      --radius: var(--radius-xl);
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
      padding-top: max(clamp(16px, 3vw, 28px), env(safe-area-inset-top));
      padding-bottom: max(clamp(16px, 3vw, 28px), env(safe-area-inset-bottom));
      padding-left: max(clamp(16px, 3vw, 28px), env(safe-area-inset-left));
      padding-right: max(clamp(16px, 3vw, 28px), env(safe-area-inset-right));
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
    /* Accessible focus rings */
    .pill:focus-visible,
    .btn:focus-visible,
    .ep-card:focus-visible,
    .search-fab:focus-visible,
    .search-overlay-close:focus-visible,
    .syn-toggle:focus-visible,
    .season-field select:focus-visible,
    .wl-btn:focus-visible,
    .cw-remove-btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    input:focus-visible {
      outline: none;
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
    @media (hover: hover) {
      .btn:hover { background: rgba(61, 214, 198, 0.28); transform: translateY(-1px); }
    }
    .btn:active { transform: scale(0.98); }
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
    .cat-more-wrap {
      display: inline-flex;
      align-items: center;
    }
    .cat-select {
      appearance: none;
      -webkit-appearance: none;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 500;
      padding: 7px 28px 7px 14px;
      cursor: pointer;
      min-height: 40px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%238b95a8' d='M0 0h10L5 6z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
    }
    .cat-select:focus-visible {
      outline: none;
      border-color: var(--accent);
      color: var(--ink);
    }
    .cat-select.is-active {
      color: var(--accent);
      border-color: rgba(61, 214, 198, 0.35);
      background-color: var(--accent-dim);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
      contain: layout style;
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
    .key-indicator {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: var(--radius-pill);
      background: var(--muted);
      margin-right: 6px;
      transition: background 0.2s ease, box-shadow 0.2s ease;
      vertical-align: middle;
    }
    .key-indicator.is-active {
      background: var(--accent);
      box-shadow: 0 0 8px rgba(61, 214, 198, 0.4);
    }
    .key-panel {
      display: none;
      gap: 10px;
      padding: 14px 16px;
      border-top: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
      border-radius: var(--radius-md);
      margin-top: 4px;
    }
    .key-panel.is-open { display: grid; }
    .key-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .key-panel-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--ink);
    }
    .key-status-pill {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      background: rgba(255, 255, 255, 0.06);
      color: var(--muted);
      border: 1px solid var(--line);
    }
    .key-status-pill.is-active {
      background: rgba(61, 214, 198, 0.12);
      color: var(--accent);
      border-color: rgba(61, 214, 198, 0.3);
    }
    .key-panel-desc {
      margin: 0;
      font-size: 0.85rem;
      color: var(--muted);
      line-height: 1.45;
    }
    .key-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      align-items: center;
    }
    @media (max-width: 480px) {
      .key-row {
        grid-template-columns: 1fr auto;
      }
      .key-row button:last-child {
        grid-column: span 2;
      }
    }
    .hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.4;
    }
    .hint code {
      background: rgba(255, 255, 255, 0.06);
      padding: 1px 4px;
      border-radius: var(--radius-sm);
      font-family: inherit;
      color: var(--ink);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 14px;
      contain: layout style;
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
      content-visibility: auto;
      contain-intrinsic-size: 148px 240px;
      transition: transform 0.22s var(--ease), border-color 0.2s ease, box-shadow 0.22s ease;
    }
    @media (hover: hover) {
      .card:hover {
        transform: translateY(-5px) scale(1.01);
        border-color: rgba(61,214,198,0.5);
        box-shadow: 0 20px 44px rgba(0,0,0,0.45), 0 0 0 1px rgba(61,214,198,0.15);
      }
      .card:hover .meta .title {
        color: var(--accent);
      }
    }
    .card:active {
      transform: scale(0.98);
    }
    .card:focus-visible {
      transform: translateY(-5px) scale(1.01);
      border-color: rgba(61,214,198,0.7);
      box-shadow: 0 20px 44px rgba(0,0,0,0.45), 0 0 0 1px rgba(61,214,198,0.3);
      outline: 2px solid var(--accent);
      outline-offset: 2px;
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
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      background: rgba(255,255,255,0.06);
      color: var(--muted);
    }
    .tick .sub { color: var(--accent); background: var(--accent-dim); }

    /* Watchlist heart button on cards */
    .card { position: relative; }
    .wl-btn {
      position: absolute; top: 6px; right: 6px;
      appearance: none; border: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
      color: rgba(255,255,255,0.6); border-radius: var(--radius-pill); width: 28px; height: 28px;
      font-size: 0.85rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s ease, color 0.15s ease, transform 0.15s ease;
      z-index: 2;
    }
    .wl-btn::after {
      content: "";
      position: absolute;
      inset: -8px;
      min-width: 44px;
      min-height: 44px;
    }
    .card:hover .wl-btn, .card:focus-within .wl-btn, .wl-btn.is-wl { opacity: 1; }
    .wl-btn.is-wl { color: #ff5f7e; }
    @media (hover: hover) {
      .wl-btn:hover { transform: scale(1.15); }
    }

    /* Continue watching progress bar */
    .cw-card { text-decoration: none; display: grid; border-radius: var(--radius-lg); overflow: hidden; }
    .cw-card-wrap { position: relative; border-radius: var(--radius-lg); overflow: hidden; cursor: pointer; }
    .cw-remove-btn {
      position: absolute; top: 5px; left: 5px;
      appearance: none; border: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
      color: rgba(255,255,255,0.75); border-radius: var(--radius-pill); width: 24px; height: 24px;
      font-size: 0.75rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s ease, background 0.15s ease;
      z-index: 3;
    }
    .cw-remove-btn::after {
      content: "";
      position: absolute;
      inset: -10px;
      min-width: 44px;
      min-height: 44px;
    }
    .cw-card-wrap:hover .cw-remove-btn { opacity: 1; }
    @media (hover: hover) {
      .cw-remove-btn:hover { background: var(--danger); color: #fff; }
    }
    @media (hover: none) or (pointer: coarse) {
      .wl-btn {
        opacity: 0.88;
        width: 32px;
        height: 32px;
        font-size: 0.9rem;
      }
      .cw-remove-btn {
        opacity: 0.88;
        width: 28px;
        height: 28px;
        font-size: 0.75rem;
      }
    }
    .cw-prog-bar {
      height: 3px; background: rgba(255,255,255,0.12); margin: 0;
    }
    .cw-prog-fill {
      height: 100%; background: var(--accent); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      transition: width 0.2s ease;
    }

    /* Undo Toast Notification */
    .ani-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      z-index: 1000;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 18px;
      background: rgba(12, 16, 24, 0.94);
      backdrop-filter: blur(18px);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
      color: var(--ink);
      font-size: 0.85rem;
      font-weight: 500;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
      max-width: min(90vw, 440px);
    }
    .ani-toast.is-visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }
    .ani-toast.is-dismissing {
      opacity: 0;
      transform: translateX(-50%) translateY(14px);
      pointer-events: none;
    }
    .toast-msg {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 260px;
    }
    .toast-act {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .toast-act:hover {
      color: #fff;
      background: var(--accent-dim);
    }
    .toast-act:focus-visible,
    .toast-close:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .toast-close {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: var(--radius-sm);
      min-height: 32px;
      min-width: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .toast-close:hover {
      color: var(--ink);
    }
    @media (max-width: 640px) {
      .ani-toast {
        bottom: 74px;
        padding: 8px 14px;
        font-size: 0.75rem;
      }
      .toast-msg {
        max-width: 180px;
      }
    }

    /* Mobile search: hidden dock, floating search button */
    .mobile-cat-bar {
      display: none;
    }
    .search-fab {
      display: none;
    }
    .search-overlay {
      display: none;
      position: fixed; inset: 0; z-index: 100;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      align-items: flex-start; justify-content: center;
      padding-top: max(16px, env(safe-area-inset-top));
      padding-bottom: max(16px, env(safe-area-inset-bottom));
      padding-left: max(16px, env(safe-area-inset-left));
      padding-right: max(16px, env(safe-area-inset-right));
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
      color: var(--ink); border-radius: 50%; width: 36px; height: 36px;
      min-width: 36px; min-height: 36px; position: relative;
      font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .search-overlay-close::after {
      content: "";
      position: absolute;
      inset: -6px;
      min-width: 44px;
      min-height: 44px;
    }
    @media (max-width: 640px) {
      .search-dock { display: none !important; }
      .search-fab {
        display: flex;
        position: fixed;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 16px));
        right: max(16px, calc(env(safe-area-inset-right) + 16px));
        z-index: 50;
        appearance: none; border: 1px solid rgba(61,214,198,0.5);
        background: var(--panel);
        backdrop-filter: blur(12px);
        color: var(--accent);
        border-radius: 999px;
        padding: 12px 18px;
        min-height: 44px;
        font: inherit;
        font-weight: 700;
        font-size: 0.9rem;
        gap: 8px;
        align-items: center;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        transition: transform 0.2s var(--ease), box-shadow 0.2s ease;
      }
      @media (hover: hover) {
        .search-fab:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.55); }
      }
      .search-fab:active { transform: scale(0.97); }
      /* Show category pills inline at top of main on mobile with sticky frosted header */
      .mobile-cat-bar {
        position: sticky;
        top: 0;
        z-index: 25;
        background: rgba(10, 12, 16, 0.92);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        margin: -8px -14px 12px;
        padding: 8px 14px;
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
      }
      .mobile-cat-bar::-webkit-scrollbar { display: none; }
      .mobile-cat-bar .pill {
        flex: 0 0 auto;
        scroll-snap-align: start;
        font-size: 0.84rem;
        padding: 8px 14px;
        min-height: 40px;
      }
      .mobile-cat-section {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--line);
      }
      .mobile-overlay-cats {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .mobile-overlay-cats .pill {
        font-size: 0.82rem;
        padding: 8px 12px;
        min-height: 38px;
      }
      .mobile-key-section {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        gap: 10px;
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
      font-size: clamp(1.05rem, 2.4vw, 1.55rem);
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
      border-radius: var(--radius-md);
      background: rgba(0,0,0,0.28);
      border: 1px solid var(--line);
    }
    .stat .k {
      display: block;
      color: var(--muted);
      font-size: 0.75rem;
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
      padding: 6px 0;
      cursor: pointer;
      width: fit-content;
      min-height: 36px;
      display: inline-flex;
      align-items: center;
    }
    .section-label {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .key-help-link {
      color: var(--accent);
      text-decoration: underline;
      text-underline-offset: 3px;
      font-weight: 600;
    }
    .key-help-link:hover {
      color: #fff;
    }
    .ep-toolbar {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .ep-toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .ep-toolbar .section-label { margin: 0; }
    .audio-toggle {
      display: inline-flex;
      align-items: center;
      padding: 3px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-pill);
      gap: 2px;
    }
    .audio-pill {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      min-height: 28px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .audio-pill:hover {
      color: var(--ink);
    }
    .audio-pill.is-active {
      background: var(--accent-dim);
      color: var(--accent);
    }
    .audio-pill:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
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
      contain: layout style;
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
      content-visibility: auto;
      contain-intrinsic-size: 200px 88px;
      transition: border-color 0.2s ease, transform 0.2s var(--ease);
    }
    @media (hover: hover) {
      .ep-card:hover {
        border-color: rgba(61,214,198,0.45);
        transform: translateY(-2px);
      }
    }
    .ep-card:active {
      transform: scale(0.99);
    }
    .ep-card.is-loading {
      opacity: 0.6;
      cursor: wait;
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
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--warning);
      background: var(--warning-dim);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      margin-left: 6px;
      cursor: help;
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
      font-size: 1.05rem;
      color: var(--ink);
    }
    .empty p { margin: 0 auto; max-width: 28rem; line-height: 1.5; }
    .empty .empty-actions {
      margin-top: 16px;
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .welcome-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      margin-bottom: 20px;
      background: var(--bg-elevated);
      border: 1px solid rgba(61, 214, 198, 0.2);
      border-radius: var(--radius-lg);
      transition: opacity 0.25s var(--ease), transform 0.25s var(--ease);
    }
    .welcome-banner.is-dismissing {
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
    }
    .welcome-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .welcome-title {
      font-size: 0.9rem;
      font-weight: 650;
      color: var(--ink);
    }
    .welcome-desc {
      margin: 0;
      font-size: 0.85rem;
      color: var(--muted);
      line-height: 1.45;
    }
    .welcome-desc kbd {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      padding: 1px 5px;
      font-size: 0.75rem;
      font-family: inherit;
      color: var(--ink);
    }
    .welcome-dismiss {
      appearance: none;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      color: var(--ink);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 8px 16px;
      min-height: 44px;
      min-width: 44px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    @media (hover: hover) {
      .welcome-dismiss:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }
    }
    @media (max-width: 600px) {
      .welcome-banner {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .welcome-dismiss {
        align-self: flex-end;
      }
    }
    /* In-Page Cinema Player Overlay */
    .cinema-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: clamp(12px, 3vw, 24px);
    }
    .cinema-overlay.is-open {
      display: flex;
    }
    .cinema-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(7, 9, 13, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .cinema-stage {
      position: relative;
      z-index: 1;
      width: min(1200px, 96vw);
      max-height: 94dvh;
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: cinemaEnter 0.22s var(--ease);
    }
    @keyframes cinemaEnter {
      from { opacity: 0; transform: scale(0.97) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .cinema-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 4px;
    }
    .cinema-meta {
      display: flex;
      align-items: baseline;
      gap: 8px;
      overflow: hidden;
    }
    .cinema-anime {
      font-size: 0.9rem;
      font-weight: 650;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cinema-episode {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent);
      white-space: nowrap;
    }
    .cinema-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .cinema-actions .pill {
      font-size: 0.85rem;
      padding: 6px 14px;
      min-height: 38px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .cinema-close {
      appearance: none;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      width: 36px;
      height: 36px;
      min-height: 44px;
      min-width: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ink);
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    @media (hover: hover) {
      .cinema-close:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.25);
      }
    }
    .cinema-viewport {
      width: 100%;
      aspect-ratio: 16 / 9;
      max-height: calc(90dvh - 56px);
      background: #000;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
    }
    .cinema-viewport iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    @media (max-width: 640px) {
      .cinema-overlay {
        padding: 0;
      }
      .cinema-stage {
        width: 100vw;
        height: 100dvh;
        max-height: 100dvh;
        padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom));
        justify-content: center;
      }
      .cinema-viewport {
        border-radius: var(--radius-md);
      }
    }
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
    footer {
      color: var(--muted);
      font-size: 0.85rem;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }
    @media (pointer: coarse) {
      .syn-toggle {
        padding: 8px 0;
        min-height: 44px;
      }
      .season-field select {
        padding: 12px 36px 12px 14px;
        min-height: 44px;
      }
      .rail::-webkit-scrollbar { display: none; }
      .rail { scrollbar-width: none; }
    }
    /* Tablet / large phone */
    @media (max-width: 640px) {
      .page {
        padding-top: max(clamp(12px, 3vw, 20px), env(safe-area-inset-top));
        padding-bottom: max(clamp(12px, 3vw, 20px), env(safe-area-inset-bottom));
        padding-left: max(clamp(12px, 3vw, 20px), env(safe-area-inset-left));
        padding-right: max(clamp(12px, 3vw, 20px), env(safe-area-inset-right));
        gap: 14px;
      }
      .pill { padding: 9px 14px; font-size: 0.84rem; min-height: 40px; }
      .btn { padding: 12px 16px; min-height: 44px; }
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
      .detail-body h2 { font-size: 1.05rem; }
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
    @media (prefers-reduced-motion: reduce) {
      body { animation: none; }
      .page, .pill, .btn, .card, .ep-card, .search-fab, .wl-btn, .cw-remove-btn, .cw-prog-fill, .ani-toast {
        transition: none;
      }
      .btn:hover, .btn:active, .card:hover, .card:active, .card:focus-visible, .ep-card:hover, .ep-card:active, .search-fab:hover, .search-fab:active, .wl-btn:hover {
        transform: none;
      }
      .skel .ph {
        animation: none;
        background: rgba(255, 255, 255, 0.06);
      }
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
        <button type="button" class="pill" id="keyToggle" aria-expanded="false" aria-controls="keyPanel" aria-label="Access settings (Guest mode)"><span class="key-indicator" id="keyIndicator"></span><span id="keyToggleLabel">Guest</span></button>
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
      <div class="key-panel" id="keyPanel" role="region" aria-label="Access settings">
        <div class="key-panel-head">
          <span class="key-panel-title">Instance Security</span>
          <span class="key-status-pill" id="keyStatusBadge">Key Required</span>
        </div>
        <p class="key-panel-desc">Playback streams are secured by the instance host. Self-hosters enter their <code>BOT_SECRET_KEY</code>. Guests can check <a href="/api" target="_blank" rel="noopener" class="key-help-link">API docs</a> or contact the server administrator.</p>
        <label class="field-label" for="apiKey">Access Key</label>
        <div class="key-row">
          <input id="apiKey" type="password" autocomplete="off" placeholder="Paste access key…" />
          <button type="button" class="btn" id="saveKey">Save</button>
          <button type="button" class="btn ghost" id="clearKey" title="Clear key">Clear</button>
        </div>
        <p class="hint">Stored in this browser tab only (<code>sessionStorage</code>). Sent as <code>x-api-key</code> with stream requests.</p>
      </div>
      <div>
        <label class="field-label" id="browseCatLabel">Browse</label>
        <div class="cat-row" id="catRow" role="tablist" aria-labelledby="browseCatLabel">
          <button type="button" class="pill is-active" role="tab" aria-selected="true" data-cat="discover" data-label="Discover">Discover</button>
          <button type="button" class="pill" role="tab" aria-selected="false" data-cat="most-popular" data-label="Most popular">Popular</button>
          <button type="button" class="pill" role="tab" aria-selected="false" data-cat="top-airing" data-label="Top airing">Top Airing</button>
          <button type="button" class="pill" role="tab" aria-selected="false" data-cat="watchlist" data-label="My Watchlist">My Watchlist</button>
          <div class="cat-more-wrap">
            <label class="sr-only" for="catFilterSelect">Filter by category</label>
            <select class="cat-select" id="catFilterSelect" aria-label="Filter by category">
              <option value="" disabled selected>More Categories ▾</option>
              <option value="recently-updated">Recently Updated</option>
              <option value="recently-added">Recently Added</option>
              <option value="most-favorite">Most Favorite</option>
              <option value="top-upcoming">Top Upcoming</option>
              <option value="movie">Movies</option>
              <option value="tv">TV Series</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>
      <div class="meta-row">
        <div class="crumbs" id="crumbs"><span>Discover</span></div>
        <p class="status" id="status"></p>
      </div>
    </div>

    <main id="main">
      <div class="skeleton-grid">
        <div class="skel"><div class="ph"></div><div class="line"></div><div class="line" style="width:55%"></div></div>
        <div class="skel"><div class="ph"></div><div class="line"></div><div class="line" style="width:55%"></div></div>
        <div class="skel"><div class="ph"></div><div class="line"></div><div class="line" style="width:55%"></div></div>
        <div class="skel"><div class="ph"></div><div class="line"></div><div class="line" style="width:55%"></div></div>
        <div class="skel"><div class="ph"></div><div class="line"></div><div class="line" style="width:55%"></div></div>
        <div class="skel"><div class="ph"></div><div class="line"></div><div class="line" style="width:55%"></div></div>
      </div>
    </main>

    <footer>${SITE_NAME} · ${SITE_TAGLINE} · cinema streaming<br />${NOTICE_SHORT}</footer>
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
      <div class="mobile-cat-section" id="mobileCatSection">
        <label class="field-label">Browse Categories</label>
        <div class="mobile-overlay-cats">
          <button type="button" class="pill" data-mobile-cat="discover">Discover</button>
          <button type="button" class="pill" data-mobile-cat="most-popular">Popular</button>
          <button type="button" class="pill" data-mobile-cat="top-airing">Top Airing</button>
          <button type="button" class="pill" data-mobile-cat="watchlist">My Watchlist</button>
          <button type="button" class="pill" data-mobile-cat="recently-updated">Updated</button>
          <button type="button" class="pill" data-mobile-cat="recently-added">New</button>
          <button type="button" class="pill" data-mobile-cat="movie">Movies</button>
          <button type="button" class="pill" data-mobile-cat="tv">TV Series</button>
        </div>
      </div>
      <div class="mobile-key-section" id="mobileKeySection">
        <div class="key-panel-head">
          <span class="key-panel-title">Instance Security</span>
          <span class="key-status-pill" id="mobileKeyStatusBadge">Key Required</span>
        </div>
        <p class="key-panel-desc">Playback streams are secured by the instance host. Self-hosters enter their <code>BOT_SECRET_KEY</code>. Guests can check <a href="/api" target="_blank" rel="noopener" class="key-help-link">API docs</a> or contact the server administrator.</p>
        <label class="field-label" for="apiKeyMobile">Access Key</label>
        <div class="key-row">
          <input id="apiKeyMobile" type="password" autocomplete="off" placeholder="Paste access key…" />
          <button type="button" class="btn" id="saveKeyMobile">Save</button>
          <button type="button" class="btn ghost" id="clearKeyMobile" title="Clear key">Clear</button>
        </div>
        <p class="hint">Stored in this browser tab only (<code>sessionStorage</code>).</p>
      </div>
    </div>
  </div>

  <!-- Mobile floating search button -->
  <button type="button" class="search-fab" id="searchFab" aria-label="Open search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
    Search
  </button>

  <!-- Cinema Player Overlay -->
  <div class="cinema-overlay" id="cinemaOverlay" role="dialog" aria-modal="true" aria-label="Cinema Player">
    <div class="cinema-backdrop" id="cinemaBackdrop"></div>
    <div class="cinema-stage">
      <div class="cinema-header">
        <div class="cinema-meta">
          <span class="cinema-anime" id="cinemaAnime"></span>
          <span class="cinema-episode" id="cinemaEpisode"></span>
        </div>
        <div class="cinema-actions">
          <a class="pill" id="cinemaNewTab" href="#" target="_blank" rel="noopener" title="Open player in new tab">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:4px;vertical-align:-1px"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
            Pop out
          </a>
          <button type="button" class="cinema-close" id="cinemaClose" aria-label="Close cinema player">✕</button>
        </div>
      </div>
      <div class="cinema-viewport">
        <iframe id="cinemaFrame" src="about:blank" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var KEY = 'ani.apiKey';
      var RAIL_CAP = 18;
      var apiKey = document.getElementById('apiKey');
      var q = document.getElementById('q');
      var searchBtn = document.getElementById('searchBtn');
      var browseTab = document.getElementById('browseTab');
      var saveKey = document.getElementById('saveKey');
      var clearKey = document.getElementById('clearKey');
      var keyToggle = document.getElementById('keyToggle');
      var keyToggleLabel = document.getElementById('keyToggleLabel');
      var keyIndicator = document.getElementById('keyIndicator');
      var keyStatusBadge = document.getElementById('keyStatusBadge');
      var keyPanel = document.getElementById('keyPanel');
      var apiKeyMobile = document.getElementById('apiKeyMobile');
      var saveKeyMobile = document.getElementById('saveKeyMobile');
      var clearKeyMobile = document.getElementById('clearKeyMobile');
      var mobileKeyStatusBadge = document.getElementById('mobileKeyStatusBadge');
      var mobileKeySection = document.getElementById('mobileKeySection');
      var catRow = document.getElementById('catRow');
      var catFilterSelect = document.getElementById('catFilterSelect');
      var main = document.getElementById('main');
      var statusEl = document.getElementById('status');
      var crumbs = document.getElementById('crumbs');
      var cinemaOverlay = document.getElementById('cinemaOverlay');
      var cinemaBackdrop = document.getElementById('cinemaBackdrop');
      var cinemaFrame = document.getElementById('cinemaFrame');
      var cinemaAnime = document.getElementById('cinemaAnime');
      var cinemaEpisode = document.getElementById('cinemaEpisode');
      var cinemaNewTab = document.getElementById('cinemaNewTab');
      var cinemaClose = document.getElementById('cinemaClose');
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
        audioPref: 'sub',
      };
      var POSTER_PROXY_BASE = ${JSON.stringify(posterProxy)};
      var POSTER_PROXY_KEY = ${JSON.stringify(posterKey)};
      var AUDIO_KEY = 'ani.audioPref';
      try {
        var savedAudio = localStorage.getItem(AUDIO_KEY);
        if (savedAudio === 'dub' || savedAudio === 'sub') state.audioPref = savedAudio;
      } catch (e) {}

      try { localStorage.removeItem(KEY); } catch (e) {}
      apiKey.value = sessionStorage.getItem(KEY) || '';
      apiKeyMobile.value = apiKey.value;

      function updateKeyUI() {
        var hasKey = !!apiKey.value.trim();
        if (keyToggleLabel) keyToggleLabel.textContent = hasKey ? 'Key Active' : 'Key Required';
        if (keyIndicator) keyIndicator.classList.toggle('is-active', hasKey);
        if (keyToggle) {
          keyToggle.setAttribute('aria-label', hasKey ? 'Access settings (Key active — streaming unlocked)' : 'Access settings (Key required to stream)');
          keyToggle.setAttribute('aria-expanded', keyPanel && keyPanel.classList.contains('is-open') ? 'true' : 'false');
        }
        if (keyStatusBadge) {
          keyStatusBadge.textContent = hasKey ? 'Streaming Unlocked' : 'Key Required to Stream';
          keyStatusBadge.classList.toggle('is-active', hasKey);
        }
        if (mobileKeyStatusBadge) {
          mobileKeyStatusBadge.textContent = hasKey ? 'Streaming Unlocked' : 'Key Required to Stream';
          mobileKeyStatusBadge.classList.toggle('is-active', hasKey);
        }
        if (clearKey) clearKey.disabled = !hasKey;
        if (clearKeyMobile) clearKeyMobile.disabled = !hasKey;
      }
      updateKeyUI();

      function persistKey() {
        var v = apiKey.value.trim() || apiKeyMobile.value.trim();
        apiKey.value = v;
        apiKeyMobile.value = v;
        if (v) { sessionStorage.setItem(KEY, v); }
        else { sessionStorage.removeItem(KEY); }
        updateKeyUI();
      }

      function clearKeyVal() {
        apiKey.value = '';
        apiKeyMobile.value = '';
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        updateKeyUI();
        setStatus('Access key cleared — key required to stream');
      }

      apiKey.addEventListener('change', persistKey);
      apiKey.addEventListener('blur', persistKey);
      apiKeyMobile.addEventListener('change', persistKey);
      apiKeyMobile.addEventListener('blur', persistKey);
      if (saveKey) {
        saveKey.addEventListener('click', function () {
          persistKey();
          setStatus(apiKey.value.trim() ? 'Access key saved — streaming unlocked' : 'Access key cleared');
          keyPanel.classList.remove('is-open');
          updateKeyUI();
          loadDiscover();
        });
      }
      if (clearKey) {
        clearKey.addEventListener('click', function () {
          clearKeyVal();
          keyPanel.classList.remove('is-open');
          loadDiscover();
        });
      }
      if (saveKeyMobile) {
        saveKeyMobile.addEventListener('click', function () {
          persistKey();
          closeSearchOverlay();
          setStatus(apiKey.value.trim() ? 'Access key saved — streaming unlocked' : 'Access key cleared');
          loadDiscover();
        });
      }
      if (clearKeyMobile) {
        clearKeyMobile.addEventListener('click', function () {
          clearKeyVal();
          closeSearchOverlay();
          loadDiscover();
        });
      }
      if (keyToggle) {
        keyToggle.addEventListener('click', function () {
          if (window.innerWidth <= 640) {
            openSearchOverlay(keyToggle);
            apiKeyMobile.value = apiKey.value;
            setTimeout(function () { mobileKeySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 120);
          } else {
            keyPanel.classList.toggle('is-open');
            updateKeyUI();
          }
        });
      }
      if (browseTab) {
        browseTab.addEventListener('click', function () {
          navigate({ view: 'discover' });
        });
      }

      function setStatus(msg, isErr) {
        statusEl.textContent = msg || '';
        statusEl.classList.toggle('is-err', !!isErr);
      }

      function requireKey(action) {
        if (!apiKey.value.trim()) {
          setStatus('Access key required to ' + (action || 'stream') + '.', true);
          if (window.innerWidth <= 640) {
            openSearchOverlay(keyToggle);
            setTimeout(function () {
              if (mobileKeySection) mobileKeySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              if (apiKeyMobile) apiKeyMobile.focus();
            }, 120);
          } else {
            keyPanel.classList.add('is-open');
            updateKeyUI();
            if (apiKey) apiKey.focus();
          }
          return false;
        }
        return true;
      }

      var lastCinemaTrigger = null;
      function openCinema(link, animeTitle, epLabel) {
        if (!cinemaFrame || !cinemaOverlay) return;
        lastCinemaTrigger = document.activeElement;
        cinemaFrame.src = link;
        if (cinemaAnime) cinemaAnime.textContent = animeTitle || '';
        if (cinemaEpisode) cinemaEpisode.textContent = epLabel ? ' · ' + epLabel : '';
        if (cinemaNewTab) cinemaNewTab.href = link;
        cinemaOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        try {
          history.pushState(Object.assign({}, history.state || {}, { inCinema: true }), '');
        } catch (e) {}
        if (cinemaClose) cinemaClose.focus();
      }

      function closeCinema(fromPop) {
        if (!cinemaOverlay) return;
        var wasOpen = cinemaOverlay.classList.contains('is-open');
        cinemaOverlay.classList.remove('is-open');
        if (cinemaFrame) cinemaFrame.src = 'about:blank';
        document.body.style.overflow = '';
        if (wasOpen && !fromPop && history.state && history.state.inCinema) {
          try { history.back(); } catch (e) {}
        }
        if (lastCinemaTrigger && typeof lastCinemaTrigger.focus === 'function') {
          lastCinemaTrigger.focus();
          lastCinemaTrigger = null;
        }
      }

      if (cinemaClose) cinemaClose.addEventListener('click', function () { closeCinema(); });
      if (cinemaBackdrop) cinemaBackdrop.addEventListener('click', function () { closeCinema(); });
      if (cinemaOverlay) {
        cinemaOverlay.addEventListener('keydown', function (e) {
          trapDialogFocus(e, cinemaOverlay);
        });
      }

      function setActiveCat(query) {
        catRow.querySelectorAll('[data-cat]').forEach(function (btn) {
          var match = btn.getAttribute('data-cat') === query;
          btn.classList.toggle('is-active', match);
          btn.setAttribute('aria-selected', match ? 'true' : 'false');
        });
        var mobileCatSection = document.getElementById('mobileCatSection');
        if (mobileCatSection) {
          mobileCatSection.querySelectorAll('[data-mobile-cat]').forEach(function (btn) {
            var match = btn.getAttribute('data-mobile-cat') === query;
            btn.classList.toggle('is-active', match);
            btn.setAttribute('aria-selected', match ? 'true' : 'false');
          });
        }
        if (catFilterSelect) {
          var isDropdownVal = false;
          for (var i = 0; i < catFilterSelect.options.length; i++) {
            if (catFilterSelect.options[i].value === query) {
              catFilterSelect.selectedIndex = i;
              isDropdownVal = true;
              break;
            }
          }
          catFilterSelect.classList.toggle('is-active', isDropdownVal);
          if (!isDropdownVal) catFilterSelect.selectedIndex = 0;
        }
      }

      var mobileCatSection = document.getElementById('mobileCatSection');
      if (mobileCatSection) {
        mobileCatSection.addEventListener('click', function (e) {
          var btn = e.target && e.target.closest ? e.target.closest('[data-mobile-cat]') : null;
          if (!btn) return;
          var cat = btn.getAttribute('data-mobile-cat');
          var label = btn.textContent || cat;
          closeSearchOverlay();
          if (cat === 'discover') navigate({ view: 'discover' });
          else if (cat === 'watchlist') navigate({ view: 'watchlist' });
          else navigate({ view: 'list', query: cat, label: label, page: 1 });
        });
      }

      if (catFilterSelect) {
        catFilterSelect.addEventListener('change', function () {
          var val = catFilterSelect.value;
          var optLabel = catFilterSelect.options[catFilterSelect.selectedIndex].text;
          if (val) {
            navigate({ view: 'list', query: val, label: optLabel, page: 1 });
          }
        });
      }

      function navigate(target, replace) {
        var params = new URLSearchParams();
        if (target.view === 'list') {
          if (target.query && target.query !== 'discover') params.set('cat', target.query);
          if (target.page && target.page > 1) params.set('page', String(target.page));
        } else if (target.view === 'watchlist') {
          params.set('cat', 'watchlist');
        } else if (target.view === 'search') {
          if (target.keyword) params.set('q', target.keyword);
        } else if (target.view === 'episodes') {
          var aid = target.animeId || (target.anime && target.anime.id);
          if (aid) params.set('anime', aid);
        }
        var queryStr = params.toString();
        var newUrl = window.location.pathname + (queryStr ? '?' + queryStr : '');
        if (replace) {
          history.replaceState(target, '', newUrl);
        } else {
          history.pushState(target, '', newUrl);
        }
        applyRoute(target);
      }

      function readCurrentRouteFromUrl() {
        var p = new URLSearchParams(window.location.search);
        if (p.has('anime')) {
          return { view: 'episodes', animeId: p.get('anime') };
        }
        if (p.has('q')) {
          return { view: 'search', keyword: p.get('q') };
        }
        if (p.has('cat')) {
          var c = p.get('cat');
          if (c === 'watchlist') return { view: 'watchlist' };
          return { view: 'list', query: c, label: null, page: parseInt(p.get('page') || '1', 10) || 1 };
        }
        return { view: 'discover' };
      }

      function applyRoute(target) {
        if (!target || target.view === 'discover') {
          loadDiscover();
        } else if (target.view === 'watchlist') {
          renderWatchlistView();
        } else if (target.view === 'list') {
          loadList(target.query, target.label, target.page || 1);
        } else if (target.view === 'search') {
          if (target.keyword) {
            if (q) q.value = target.keyword;
            doSearch();
          } else {
            loadDiscover();
          }
        } else if (target.view === 'episodes') {
          loadEpisodes(target.anime || { id: target.animeId });
        }
      }

      window.addEventListener('popstate', function () {
        if (cinemaOverlay && cinemaOverlay.classList.contains('is-open')) {
          closeCinema(true);
          return;
        }
        if (searchOverlay && searchOverlay.classList.contains('is-open')) {
          closeSearchOverlay();
          return;
        }
        applyRoute(readCurrentRouteFromUrl());
      });

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
            updateKeyUI();
            setStatus('Private instance: Access key required.', true);
            throw new Error('Unauthorized — set your access key.');
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
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
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
        if (state.source === 'watchlist') {
          return { label: 'My Watchlist', action: 'watchlist' };
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
            if (action === 'search') {
              navigate({ view: 'search', keyword: (q && q.value.trim()) || '' });
            } else if (action === 'list') {
              navigate({ view: 'list', query: state.listQuery, label: state.listLabel, page: state.listPage });
            } else if (action === 'watchlist') {
              navigate({ view: 'watchlist' });
            } else if (action === 'discover') {
              navigate({ view: 'discover' });
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

      // ── Toast notification system ──────────────────────────────────────────
      var toastTimer = null;
      function showToast(message, actionLabel, onAction) {
        var toast = document.getElementById('aniToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'aniToast';
          toast.className = 'ani-toast';
          toast.setAttribute('role', 'status');
          toast.setAttribute('aria-live', 'polite');
          document.body.appendChild(toast);
        }
        if (toastTimer) {
          clearTimeout(toastTimer);
          toastTimer = null;
        }
        toast.innerHTML = '';

        var msgSpan = document.createElement('span');
        msgSpan.className = 'toast-msg';
        msgSpan.textContent = message;
        toast.appendChild(msgSpan);

        if (actionLabel && typeof onAction === 'function') {
          var actBtn = document.createElement('button');
          actBtn.type = 'button';
          actBtn.className = 'toast-act';
          actBtn.textContent = actionLabel;
          actBtn.addEventListener('click', function () {
            clearTimeout(toastTimer);
            dismissToast();
            onAction();
          });
          toast.appendChild(actBtn);
        }

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Dismiss notification');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', function () {
          clearTimeout(toastTimer);
          dismissToast();
        });
        toast.appendChild(closeBtn);

        toast.classList.remove('is-dismissing');
        toast.classList.add('is-visible');

        toastTimer = setTimeout(function () {
          dismissToast();
        }, 5000);
      }

      function dismissToast() {
        var toast = document.getElementById('aniToast');
        if (!toast) return;
        toast.classList.add('is-dismissing');
        setTimeout(function () {
          toast.classList.remove('is-visible', 'is-dismissing');
        }, 220);
      }

      // ── Watchlist ──────────────────────────────────────────────────────────
      var WL_KEY = 'ani.watchlist';
      var wlCache = null;
      var wlSet = null;
      function readWatchlist() {
        if (wlCache !== null) return wlCache;
        try { wlCache = JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch (e) { wlCache = []; }
        return wlCache;
      }
      function getWlSet() {
        if (wlSet !== null) return wlSet;
        var list = readWatchlist();
        wlSet = {};
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].id) wlSet[list[i].id] = true;
        }
        return wlSet;
      }
      function isInWatchlist(id) {
        return !!getWlSet()[id];
      }
      function heartIcon(filled) {
        if (filled) {
          return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
        }
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
      }
      function toggleWatchlist(a, heartBtn) {
        var list = readWatchlist().slice();
        var idx = list.findIndex(function (x) { return x.id === a.id; });
        var removedItem = null;
        var removedIndex = -1;
        if (idx >= 0) {
          removedItem = list[idx];
          removedIndex = idx;
          list.splice(idx, 1);
        } else {
          list.unshift({ id: a.id, name: a.name, poster: Array.isArray(a.poster) ? a.poster[0] : a.poster });
          if (list.length > 200) list = list.slice(0, 200);
        }
        try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch (e) {}
        wlCache = list;
        wlSet = null;
        var inWl = idx < 0; // we just added it
        heartBtn.innerHTML = heartIcon(inWl);
        heartBtn.classList.toggle('is-wl', inWl);
        heartBtn.setAttribute('aria-label', inWl ? 'Remove from watchlist' : 'Add to watchlist');

        if (!inWl && removedItem) {
          var titleName = a.name || a.id || 'title';
          var cardEl = heartBtn.closest ? heartBtn.closest('.card') : null;
          var nextSibling = cardEl ? cardEl.nextSibling : null;
          var parentGrid = cardEl ? cardEl.parentNode : null;

          if (state.view === 'watchlist' && cardEl) {
            cardEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            cardEl.style.opacity = '0';
            cardEl.style.transform = 'scale(0.95)';
            setTimeout(function () {
              if (cardEl.parentNode) cardEl.remove();
              var grid = document.getElementById('animeGrid');
              if (grid && !grid.children.length) {
                renderWatchlistView();
              } else {
                var hint = main.querySelector('.rail-head .hint-inline');
                if (hint) {
                  var remaining = list.length;
                  hint.textContent = remaining + ' saved ' + (remaining === 1 ? 'title' : 'titles');
                }
              }
            }, 200);
          }

          showToast('Removed "' + titleName + '" from Watchlist', 'Undo', function () {
            var curList = readWatchlist().slice();
            if (removedIndex >= 0 && removedIndex <= curList.length) {
              curList.splice(removedIndex, 0, removedItem);
            } else {
              curList.unshift(removedItem);
            }
            try { localStorage.setItem(WL_KEY, JSON.stringify(curList)); } catch (e) {}
            wlCache = curList;
            wlSet = null;
            heartBtn.innerHTML = heartIcon(true);
            heartBtn.classList.add('is-wl');
            heartBtn.setAttribute('aria-label', 'Remove from watchlist');

            if (state.view === 'watchlist') {
              if (parentGrid && cardEl) {
                cardEl.style.opacity = '1';
                cardEl.style.transform = 'none';
                if (nextSibling && nextSibling.parentNode === parentGrid) {
                  parentGrid.insertBefore(cardEl, nextSibling);
                } else {
                  parentGrid.appendChild(cardEl);
                }
                var hint = main.querySelector('.rail-head .hint-inline');
                if (hint) {
                  var total = curList.length;
                  hint.textContent = total + ' saved ' + (total === 1 ? 'title' : 'titles');
                }
              } else {
                renderWatchlistView();
              }
            }
            showToast('Restored "' + titleName + '" to Watchlist');
          });
        }
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
        var railFrag = document.createDocumentFragment();
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
            var removedEntry = entry;
            var removedIndex = -1;
            var currentCw = readCw();
            for (var i = 0; i < currentCw.length; i++) {
              if (currentCw[i].id === entry.id) {
                removedIndex = i;
                break;
              }
            }
            cwRemove(entry.id);
            var nextSibling = card.nextSibling;
            var parentRail = card.parentNode;
            card.remove();
            if (parentRail && !parentRail.children.length && wrap.parentNode) {
              wrap.style.display = 'none';
            }
            var titleStr = entry.name || entry.id || 'title';
            showToast('Removed "' + titleStr + '" from Continue Watching', 'Undo', function () {
              try {
                var list = readCw().filter(function (x) { return x.id !== removedEntry.id; });
                if (removedIndex >= 0 && removedIndex <= list.length) {
                  list.splice(removedIndex, 0, removedEntry);
                } else {
                  list.unshift(removedEntry);
                }
                localStorage.setItem(CW_KEY, JSON.stringify(list));
              } catch (e) {}
              if (parentRail) {
                if (nextSibling && nextSibling.parentNode === parentRail) {
                  parentRail.insertBefore(card, nextSibling);
                } else {
                  parentRail.appendChild(card);
                }
                if (wrap.style.display === 'none') {
                  wrap.style.display = '';
                }
              } else if (state.view === 'discover') {
                loadDiscover();
              }
              showToast('Restored "' + titleStr + '"');
            });
          });
          card.appendChild(link);
          card.appendChild(removeBtn);
          railFrag.appendChild(card);
        });
        rail.appendChild(railFrag);
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
          heartIcon(inWl) + '</button>';
        btn.addEventListener('click', function () {
          navigate({ view: 'episodes', animeId: a.id, anime: a });
        });
        // Watchlist heart click (stop propagation so card click doesn't fire)
        btn.querySelector('.wl-btn').addEventListener('click', function (e) {
          e.stopPropagation();
          toggleWatchlist(a, this);
        });
        return btn;
      }

      function fillGrid(grid, animes) {
        var frag = document.createDocumentFragment();
        animes.forEach(function (a) { frag.appendChild(animeCard(a)); });
        grid.appendChild(frag);
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
        var bar = document.createElement('div');
        bar.className = 'mobile-cat-bar';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Browse categories');
        var coreCats = [
          { q: 'discover', label: 'Discover' },
          { q: 'most-popular', label: 'Popular' },
          { q: 'top-airing', label: 'Airing' },
          { q: 'watchlist', label: 'Watchlist' },
        ];
        coreCats.forEach(function (c) {
          var btn = document.createElement('button');
          btn.type = 'button';
          var isCurrent = c.q === activeCat;
          btn.className = 'pill' + (isCurrent ? ' is-active' : '');
          btn.setAttribute('role', 'tab');
          btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
          btn.textContent = c.label;
          btn.addEventListener('click', function () {
            if (c.q === 'discover') navigate({ view: 'discover' });
            else if (c.q === 'watchlist') navigate({ view: 'watchlist' });
            else navigate({ view: 'list', query: c.q, label: c.label, page: 1 });
          });
          bar.appendChild(btn);
        });

        var moreWrap = document.createElement('div');
        moreWrap.className = 'cat-more-wrap';
        var moreSelect = document.createElement('select');
        moreSelect.className = 'cat-select';
        moreSelect.setAttribute('aria-label', 'More categories');
        moreSelect.innerHTML =
          '<option value="" disabled selected>More ▾</option>' +
          '<option value="recently-updated">Updated</option>' +
          '<option value="recently-added">New</option>' +
          '<option value="most-favorite">Favorite</option>' +
          '<option value="top-upcoming">Upcoming</option>' +
          '<option value="movie">Movies</option>' +
          '<option value="tv">TV</option>' +
          '<option value="completed">Completed</option>';
        for (var i = 1; i < moreSelect.options.length; i++) {
          if (moreSelect.options[i].value === activeCat) {
            moreSelect.selectedIndex = i;
            moreSelect.classList.add('is-active');
            break;
          }
        }
        moreSelect.addEventListener('change', function () {
          var val = moreSelect.value;
          var optLabel = moreSelect.options[moreSelect.selectedIndex].text;
          if (val) navigate({ view: 'list', query: val, label: optLabel, page: 1 });
        });
        moreWrap.appendChild(moreSelect);
        bar.appendChild(moreWrap);

        return bar;
      }

      function renderWatchlistView() {
        state.view = 'watchlist';
        state.source = 'watchlist';
        state.anime = null;
        setActiveCat('watchlist');
        setCrumbs([
          { label: 'Discover', action: 'discover' },
          { label: 'My Watchlist' },
        ]);
        var list = readWatchlist();
        if (!list.length) {
          main.innerHTML =
            '<div class="empty">' +
              '<h2>Your watchlist is empty</h2>' +
              '<p>Click the heart icon on any anime card to save titles for quick access later.</p>' +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="wlToDiscover">Explore Discover</button></div>' +
            '</div>';
          var toDisc = document.getElementById('wlToDiscover');
          if (toDisc) toDisc.addEventListener('click', function () { navigate({ view: 'discover' }); });
          return;
        }
        main.innerHTML =
          '<div class="rail-head" style="margin-bottom:14px"><h2>My Watchlist</h2>' +
          '<span class="hint-inline">' + list.length + ' saved ' + (list.length === 1 ? 'title' : 'titles') + '</span></div>' +
          '<div class="grid" id="animeGrid"></div>';
        var items = list.map(function (x) {
          return { id: x.id, name: x.name, poster: x.poster ? [x.poster] : [], episodes: {} };
        });
        fillGrid(document.getElementById('animeGrid'), items);
        main.insertBefore(renderMobileCatBar('watchlist'), main.firstChild);
      }

      function renderWelcomeBanner() {
        try {
          if (localStorage.getItem('ani.welcome_seen')) return null;
        } catch (e) { return null; }
        var banner = document.createElement('section');
        banner.className = 'welcome-banner';
        banner.id = 'welcomeBanner';
        banner.innerHTML =
          '<div class="welcome-body">' +
            '<div class="welcome-title">Welcome to ani.watch</div>' +
            '<p class="welcome-desc">Explore trending anime, search your favorite series with <kbd>/</kbd>, and build your watchlist without an account.</p>' +
          '</div>' +
          '<button type="button" class="welcome-dismiss" id="welcomeDismiss" aria-label="Dismiss welcome message">Got it</button>';
        var dismiss = banner.querySelector('#welcomeDismiss');
        if (dismiss) {
          dismiss.addEventListener('click', function () {
            try { localStorage.setItem('ani.welcome_seen', '1'); } catch (e) {}
            banner.classList.add('is-dismissing');
            setTimeout(function () { banner.remove(); }, 250);
          });
        }
        return banner;
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
        var welcome = renderWelcomeBanner();
        if (welcome) main.appendChild(welcome);
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
          main.innerHTML =
            '<div class="empty">' +
              "<h2>Catalog currently unavailable</h2>" +
              "<p>We couldn't load the discover catalog right now. Try refreshing or search for a title directly.</p>" +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="emptyRetryBtn">Retry Discover</button></div>' +
            '</div>';
          var retryBtn = document.getElementById('emptyRetryBtn');
          if (retryBtn) retryBtn.addEventListener('click', function () { loadDiscover(); });
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
          main.innerHTML =
            '<div class="empty">' +
              '<h2>No titles found</h2>' +
              '<p>This category has no titles on this page.</p>' +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="listBackBtn">Back to Discover</button></div>' +
            '</div>';
          var backBtn = document.getElementById('listBackBtn');
          if (backBtn) backBtn.addEventListener('click', function () { navigate({ view: 'discover' }); });
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
          if (page > 1) navigate({ view: 'list', query: state.listQuery, label: state.listLabel, page: page - 1 });
        });
        if (next) next.addEventListener('click', function () {
          if (hasNext) navigate({ view: 'list', query: state.listQuery, label: state.listLabel, page: page + 1 });
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
          main.innerHTML =
            '<div class="empty">' +
              "<h2>No matches found</h2>" +
              "<p>We couldn't find any titles matching your search. Try another spelling or a shorter keyword.</p>" +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="searchBackBtn">Back to Discover</button></div>' +
            '</div>';
          var sBackBtn = document.getElementById('searchBackBtn');
          if (sBackBtn) sBackBtn.addEventListener('click', function () { navigate({ view: 'discover' }); });
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
            '<div class="ep-toolbar-left">' +
              '<p class="section-label">Episodes</p>' +
              '<div class="audio-toggle" id="audioToggle" role="group" aria-label="Audio format">' +
                '<button type="button" class="audio-pill' + (state.audioPref === 'sub' ? ' is-active' : '') + '" data-audio="sub" aria-pressed="' + (state.audioPref === 'sub' ? 'true' : 'false') + '">SUB</button>' +
                '<button type="button" class="audio-pill' + (state.audioPref === 'dub' ? ' is-active' : '') + '" data-audio="dub" aria-pressed="' + (state.audioPref === 'dub' ? 'true' : 'false') + '">DUB</button>' +
              '</div>' +
            '</div>' +
            seasonBar +
          '</div>' +
          '<div class="ep-grid" id="epGrid"></div>';

        main.innerHTML = detailHtml;

        var audioToggle = document.getElementById('audioToggle');
        if (audioToggle) {
          audioToggle.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest ? e.target.closest('[data-audio]') : null;
            if (!btn) return;
            var chosen = btn.getAttribute('data-audio');
            if (!chosen || chosen === state.audioPref) return;
            state.audioPref = chosen;
            try { localStorage.setItem(AUDIO_KEY, chosen); } catch (e) {}
            audioToggle.querySelectorAll('[data-audio]').forEach(function (b) {
              var match = b.getAttribute('data-audio') === chosen;
              b.classList.toggle('is-active', match);
              b.setAttribute('aria-pressed', match ? 'true' : 'false');
            });
            setStatus('Audio preference set to ' + chosen.toUpperCase());
          });
        }

        var seasonSelect = document.getElementById('seasonSelect');
        if (seasonSelect) {
          seasonSelect.addEventListener('change', function () {
            var nextId = seasonSelect.value;
            if (!nextId || nextId === anime.id) return;
            var s = null;
            for (var i = 0; i < seasons.length; i++) {
              if (seasons[i].id === nextId) { s = seasons[i]; break; }
            }
            navigate({
              view: 'episodes',
              animeId: nextId,
              anime: {
                id: nextId,
                name: (s && (s.title || s.alternativeTitle)) || nextId,
                jname: s && s.alternativeTitle,
                poster: (s && s.poster) || poster || anime.poster || null,
              },
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
        var frag = document.createDocumentFragment();
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
            (ep.isFiller ? '<span class="badge" title="Filler episode (non-canon storyline)" aria-label="Filler episode (non-canon)">Filler</span>' : '') +
            '</div>' +
            (secondary ? '<div class="sub">' + esc(secondary) + '</div>' : '') +
            '</div>';
          btn.addEventListener('click', function () { playEpisode(ep, btn); });
          frag.appendChild(btn);
        });
        grid.appendChild(frag);
      }

      async function loadDiscover() {
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
          main.innerHTML =
            '<div class="empty">' +
              '<h2>Discover failed to load</h2>' +
              '<p>' + esc((err && err.message) || 'Try again shortly.') + '</p>' +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="discoverRetryBtn">Try again</button></div>' +
            '</div>';
          var dRetry = document.getElementById('discoverRetryBtn');
          if (dRetry) dRetry.addEventListener('click', function () { loadDiscover(); });
        }
      }

      async function loadList(query, label, page) {
        if (!query || query === 'discover') {
          loadDiscover();
          return;
        }
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
          main.innerHTML =
            '<div class="empty">' +
              '<h2>Browse failed to load</h2>' +
              '<p>' + esc((err && err.message) || 'Try again shortly.') + '</p>' +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="listRetryBtn">Try again</button></div>' +
            '</div>';
          var lRetry = document.getElementById('listRetryBtn');
          if (lRetry) lRetry.addEventListener('click', function () { loadList(query, label, page); });
        }
      }

      async function doSearch() {
        var keyword = q.value.trim();
        if (!keyword) {
          setStatus('Enter a search term.', true);
          return;
        }
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
          main.innerHTML =
            '<div class="empty">' +
              '<h2>Search failed</h2>' +
              '<p>' + esc((err && err.message) || 'Try again shortly.') + '</p>' +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="searchRetryBtn">Try again</button></div>' +
            '</div>';
          var sRetry = document.getElementById('searchRetryBtn');
          if (sRetry) sRetry.addEventListener('click', function () { doSearch(); });
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
          main.innerHTML =
            '<div class="empty">' +
              '<h2>Could not load episodes</h2>' +
              '<p>' + esc((err && err.message) || 'Try again shortly.') + '</p>' +
              '<div class="empty-actions"><button type="button" class="btn ghost" id="epRetryBtn">Try again</button></div>' +
            '</div>';
          var epRetry = document.getElementById('epRetryBtn');
          if (epRetry) epRetry.addEventListener('click', function () { loadEpisodes(anime); });
        }
      }

      var resolvingStream = false;
      async function playEpisode(ep, btn) {
        if (!requireKey('stream')) return;
        if (resolvingStream) return;
        var episodeId = ep.episodeId || ep.id;
        if (!episodeId) {
          setStatus('Missing episode id.', true);
          return;
        }
        resolvingStream = true;
        if (btn) {
          btn.classList.add('is-loading');
          btn.setAttribute('aria-busy', 'true');
        }
        setStatus('Resolving stream…');
        try {
          var audioCat = state.audioPref || 'sub';
          var params = new URLSearchParams({
            animeEpisodeId: String(episodeId).replace('::', '?'),
            server: 'hd-1',
            category: audioCat,
          });
          var data = await getJson('/api/v2/hianime/episode/sources?' + params.toString(), 25000);
          var link =
            data.link ||
            (data.tracks && data.tracks[audioCat] && data.tracks[audioCat].link) ||
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
          setStatus('Playing in cinema…');
          var epNum = ep.number;
          var raw = String(ep.title || ep.alternativeTitle || '').trim();
          var generic = !raw || /^episode\s*#?\s*\d+$/i.test(raw) || (epNum != null && raw === String(epNum));
          var epTag = epNum != null ? 'Ep ' + epNum : 'Episode';
          var epLabel = (generic ? epTag : epTag + ' · ' + raw) + ' (' + audioCat.toUpperCase() + ')';
          var animeName = (state.anime && (state.anime.name || state.anime.title)) || 'Anime';
          openCinema(link, animeName, epLabel);
        } catch (err) {
          setStatus((err && err.message) || 'Could not resolve stream', true);
        } finally {
          resolvingStream = false;
          if (btn) {
            btn.classList.remove('is-loading');
            btn.removeAttribute('aria-busy');
          }
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
        if (query === 'discover') navigate({ view: 'discover' });
        else if (query === 'watchlist') navigate({ view: 'watchlist' });
        else navigate({ view: 'list', query: query, label: label, page: 1 });
      });

      function submitSearch() {
        var keyword = q.value.trim();
        if (!keyword) {
          setStatus('Enter a search term.', true);
          return;
        }
        navigate({ view: 'search', keyword: keyword });
      }

      searchBtn.addEventListener('click', submitSearch);
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitSearch();
      });

      // Mobile search FAB + overlay
      var searchFab = document.getElementById('searchFab');
      var searchOverlay = document.getElementById('searchOverlay');
      var searchOverlayClose = document.getElementById('searchOverlayClose');
      var qMobile = document.getElementById('qMobile');
      var searchBtnMobile = document.getElementById('searchBtnMobile');
      var lastFocusedTrigger = null;

      function openSearchOverlay(trigger) {
        lastFocusedTrigger = trigger || document.activeElement;
        searchOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        apiKeyMobile.value = apiKey.value;
        updateKeyUI();
        setTimeout(function () { if (qMobile) qMobile.focus(); }, 80);
      }
      function closeSearchOverlay() {
        searchOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
          lastFocusedTrigger.focus();
          lastFocusedTrigger = null;
        }
      }
      function trapDialogFocus(e, dialogEl) {
        if (e.key !== 'Tab') return;
        var focusables = dialogEl.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      if (searchFab) searchFab.addEventListener('click', function () { openSearchOverlay(searchFab); });
      if (searchOverlayClose) searchOverlayClose.addEventListener('click', closeSearchOverlay);
      if (searchOverlay) {
        searchOverlay.addEventListener('click', function (e) {
          if (e.target === searchOverlay) closeSearchOverlay();
        });
        searchOverlay.addEventListener('keydown', function (e) {
          trapDialogFocus(e, searchOverlay);
        });
      }
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          if (cinemaOverlay && cinemaOverlay.classList.contains('is-open')) {
            e.preventDefault();
            closeCinema();
          } else if (searchOverlay && searchOverlay.classList.contains('is-open')) {
            e.preventDefault();
            closeSearchOverlay();
          } else if (keyPanel && keyPanel.classList.contains('is-open')) {
            e.preventDefault();
            keyPanel.classList.remove('is-open');
            updateKeyUI();
            if (keyToggle) keyToggle.focus();
          }
        } else if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) && !e.altKey) {
          var tag = document.activeElement && document.activeElement.tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !document.activeElement.isContentEditable) {
            e.preventDefault();
            if (window.innerWidth <= 640) {
              openSearchOverlay();
            } else if (q) {
              q.focus();
              q.select();
            }
          }
        }
      });
      async function doMobileSearch() {
        var keyword = (qMobile && qMobile.value.trim()) || '';
        if (!keyword) return;
        // Sync to desktop input
        q.value = keyword;
        closeSearchOverlay();
        navigate({ view: 'search', keyword: keyword });
      }
      if (searchBtnMobile) searchBtnMobile.addEventListener('click', doMobileSearch);
      if (qMobile) {
        qMobile.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') doMobileSearch();
        });
      }

      var initialRoute = readCurrentRouteFromUrl();
      history.replaceState(initialRoute, '', window.location.href);
      applyRoute(initialRoute);
      if (initialRoute.view === 'discover' && window.innerWidth > 640 && !apiKey.value.trim()) {
        setTimeout(function () { try { q.focus(); } catch (e) {} }, 150);
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
      'Cache-Control': 'public, max-age=120',
    },
  });
};

export default browseController;

import { Context } from 'hono';
import { faviconLinkTags, SITE_NAME, SITE_TAGLINE } from '../utils/brand';
import { requestOrigin } from '../utils/streamUrls';

const browseController = async (c: Context) => {
  const origin = requestOrigin(c);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>Browse — ${SITE_NAME}</title>
  <meta name="description" content="Browse and watch anime on ${SITE_NAME}" />
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
      background:
        radial-gradient(1100px 560px at 30% -12%, rgba(61, 214, 198, 0.14), transparent 55%),
        radial-gradient(900px 500px at 100% 70%, rgba(70, 100, 180, 0.12), transparent 50%),
        linear-gradient(180deg, #0d1219 0%, var(--bg0) 42%, #05070a 100%);
    }
    .page {
      max-width: var(--max);
      margin: 0 auto;
      padding: clamp(16px, 3vw, 28px);
      display: grid;
      gap: 16px;
      min-height: 100dvh;
      grid-template-rows: auto auto 1fr auto;
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
      transform: translateY(-4px);
      border-color: rgba(61,214,198,0.4);
      box-shadow: 0 18px 40px rgba(0,0,0,0.4);
      outline: none;
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
    @media (max-width: 560px) {
      .grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
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
      <div class="meta-row">
        <div class="crumbs" id="crumbs"><span>Search a title to begin</span></div>
        <p class="status" id="status"></p>
      </div>
    </div>

    <main id="main">
      <div class="empty">
        <h2>Find something to watch</h2>
        <p>Enter your API key once, then search. Posters load through our proxy — open an episode to launch the player.</p>
      </div>
    </main>

    <footer>${SITE_NAME} · ${SITE_TAGLINE} · watch opens in a new tab</footer>
  </div>

  <script>
    (function () {
      var KEY = 'ani.apiKey';
      var apiKey = document.getElementById('apiKey');
      var q = document.getElementById('q');
      var searchBtn = document.getElementById('searchBtn');
      var saveKey = document.getElementById('saveKey');
      var keyToggle = document.getElementById('keyToggle');
      var keyPanel = document.getElementById('keyPanel');
      var main = document.getElementById('main');
      var statusEl = document.getElementById('status');
      var crumbs = document.getElementById('crumbs');
      var state = { view: 'home', anime: null, lastAnimes: [] };

      try { localStorage.removeItem(KEY); } catch (e) {}
      apiKey.value = sessionStorage.getItem(KEY) || '';
      if (!apiKey.value.trim()) keyPanel.classList.add('is-open');

      function persistKey() {
        var v = apiKey.value.trim();
        if (v) sessionStorage.setItem(KEY, v);
        else sessionStorage.removeItem(KEY);
      }
      apiKey.addEventListener('change', persistKey);
      apiKey.addEventListener('blur', persistKey);
      saveKey.addEventListener('click', function () {
        persistKey();
        setStatus(apiKey.value.trim() ? 'API key saved for this tab' : 'API key cleared');
        keyPanel.classList.remove('is-open');
      });
      keyToggle.addEventListener('click', function () {
        keyPanel.classList.toggle('is-open');
      });

      function setStatus(msg, isErr) {
        statusEl.textContent = msg || '';
        statusEl.classList.toggle('is-err', !!isErr);
      }

      function headers() {
        var h = { Accept: 'application/json' };
        var key = apiKey.value.trim();
        if (key) h['x-api-key'] = key;
        return h;
      }

      async function getJson(path) {
        var res = await fetch(path, { headers: headers() });
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
      }

      function esc(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
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

      /** Proxy first (CDN hotlink bypass), then direct URL as backup. */
      function posterCandidates(list) {
        var seen = {};
        var out = [];
        (list || []).forEach(function (url) {
          var abs = absUrl(url);
          if (!abs || seen['u:' + abs]) return;
          seen['u:' + abs] = 1;
          var proxied = '/api/v2/hianime/poster?url=' + encodeURIComponent(abs);
          if (!seen[proxied]) { seen[proxied] = 1; out.push(proxied); }
          if (!seen[abs]) { seen[abs] = 1; out.push(abs); }
        });
        return out;
      }

      window.__aniPosterFail = function (img) {
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

      function setCrumbs(parts) {
        crumbs.innerHTML = parts.map(function (p) {
          if (p.action) {
            return '<button type="button" class="pill" data-crumb="' + esc(p.action) + '">' + esc(p.label) + '</button>';
          }
          return '<strong>' + esc(p.label) + '</strong>';
        }).join('<span aria-hidden="true">/</span>');
        crumbs.querySelectorAll('[data-crumb]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (btn.getAttribute('data-crumb') === 'search') renderSearch(state.lastAnimes || []);
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

      function renderSearch(animes) {
        state.view = 'search';
        state.anime = null;
        state.lastAnimes = animes;
        setCrumbs([{ label: animes.length + ' result' + (animes.length === 1 ? '' : 's') }]);
        if (!animes.length) {
          main.innerHTML = '<div class="empty"><h2>No matches</h2><p>Try another spelling or a shorter keyword.</p></div>';
          return;
        }
        main.innerHTML = '<div class="grid" id="animeGrid"></div>';
        var grid = document.getElementById('animeGrid');
        animes.forEach(function (a) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'card';
          var eps = a.episodes || {};
          var ticks = '';
          if (a.type) ticks += '<span>' + esc(a.type) + '</span>';
          if (eps.sub != null) ticks += '<span class="sub">SUB ' + esc(eps.sub) + '</span>';
          if (eps.dub != null) ticks += '<span>DUB ' + esc(eps.dub) + '</span>';
          btn.innerHTML =
            posterImg(a.poster, a.name) +
            '<div class="meta"><div class="title">' + esc(a.name || a.id) + '</div>' +
            '<div class="tick">' + ticks + '</div></div>';
          btn.addEventListener('click', function () { loadEpisodes(a); });
          grid.appendChild(btn);
        });
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
          { label: 'Results', action: 'search' },
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
          '<p class="section-label">Episodes</p>' +
          '<div class="ep-grid" id="epGrid"></div>';

        main.innerHTML = detailHtml;

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
            posterImg([ep.poster, poster].concat(posterFallbacks), primary) +
            '<div class="meta"><div class="title">' + esc(primary) +
            (ep.isFiller ? '<span class="badge">Filler</span>' : '') +
            '</div>' +
            (secondary ? '<div class="sub">' + esc(secondary) + '</div>' : '') +
            '</div>';
          btn.addEventListener('click', function () { playEpisode(ep); });
          grid.appendChild(btn);
        });
      }

      async function doSearch() {
        var keyword = q.value.trim();
        if (!keyword) {
          setStatus('Enter a search term.', true);
          return;
        }
        if (!apiKey.value.trim()) {
          keyPanel.classList.add('is-open');
          setStatus('API key required for search.', true);
          return;
        }
        persistKey();
        searchBtn.disabled = true;
        setStatus('Searching…');
        showSkeleton(10);
        try {
          var data = await getJson('/api/v2/hianime/search?keyword=' + encodeURIComponent(keyword));
          var animes = data.animes || data.response || [];
          setStatus(animes.length + ' result' + (animes.length === 1 ? '' : 's'));
          renderSearch(animes);
        } catch (err) {
          setStatus(err.message || 'Search failed', true);
          main.innerHTML = '<div class="empty"><h2>Search failed</h2><p>' + esc(err.message || 'Try again shortly.') + '</p></div>';
        } finally {
          searchBtn.disabled = false;
        }
      }

      async function loadEpisodes(anime) {
        if (!anime || !anime.id) return;
        setStatus('Loading details…');
        showSkeleton(8);
        try {
          var id = encodeURIComponent(anime.id);
          var results = await Promise.all([
            getJson('/api/v2/hianime/anime/' + id + '/episodes'),
            getJson('/api/v2/anime/' + id).catch(function () { return null; }),
          ]);
          var data = results[0];
          var detail = results[1];
          setStatus((data.totalEpisodes || (data.episodes || []).length) + ' episodes');
          renderEpisodes(anime, data, detail);
        } catch (err) {
          setStatus(err.message || 'Could not load episodes', true);
          main.innerHTML = '<div class="empty"><h2>Could not load episodes</h2><p>' + esc(err.message || '') + '</p></div>';
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
          var data = await getJson('/api/v2/hianime/episode/sources?' + params.toString());
          var link =
            data.link ||
            (data.tracks && data.tracks.sub && data.tracks.sub.link) ||
            (data.sources && data.sources[0] && data.sources[0].url);
          if (!link) throw new Error('No watch link returned.');
          setStatus('Opening player…');
          window.open(link, '_blank', 'noopener');
        } catch (err) {
          setStatus(err.message || 'Could not resolve stream', true);
        }
      }

      searchBtn.addEventListener('click', doSearch);
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doSearch();
      });
      q.focus();
    })();
  </script>
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

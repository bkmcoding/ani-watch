import { Context } from 'hono';

const browseController = async (_c: Context) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>Browse — ani.watch</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg0: #0a0c10;
      --ink: #e8edf5;
      --muted: #8b95a8;
      --accent: #3dd6c6;
      --accent-dim: rgba(61, 214, 198, 0.18);
      --danger: #ff7b72;
      --line: rgba(255, 255, 255, 0.12);
      --panel: rgba(14, 18, 26, 0.86);
      --radius: 16px;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg0); color: var(--ink); font-family: "DM Sans", system-ui, sans-serif; }
    body {
      min-height: 100dvh;
      background:
        radial-gradient(1100px 560px at 40% -10%, rgba(61, 214, 198, 0.12), transparent 55%),
        radial-gradient(900px 500px at 100% 80%, rgba(80, 110, 180, 0.1), transparent 50%),
        linear-gradient(180deg, #0d1118 0%, var(--bg0) 45%, #080a0e 100%);
    }
    .page {
      max-width: 1120px;
      margin: 0 auto;
      padding: clamp(16px, 3vw, 28px);
      display: grid;
      gap: 18px;
      min-height: 100dvh;
      grid-template-rows: auto auto 1fr auto;
    }
    header {
      display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    }
    .brand-wrap { display: flex; flex-direction: column; gap: 2px; }
    .brand {
      font-family: Syne, sans-serif; font-weight: 700; margin: 0;
      font-size: clamp(1.5rem, 3vw, 2rem); letter-spacing: -0.03em;
    }
    .brand span { color: var(--accent); }
    .brand-by { margin: 0; font-size: 0.72rem; letter-spacing: 0.06em; color: var(--muted); text-transform: lowercase; }
    .brand-by em { font-style: normal; color: var(--accent); font-weight: 600; }
    .nav { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill {
      appearance: none; border: 1px solid var(--line); background: rgba(255,255,255,0.04);
      color: var(--muted); font: inherit; font-size: 0.82rem; font-weight: 600;
      text-decoration: none; padding: 8px 14px; border-radius: 999px; cursor: pointer;
      transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    }
    .pill:hover, .pill.is-active { color: var(--accent); background: var(--accent-dim); border-color: rgba(61,214,198,0.35); }
    .toolbar {
      display: grid; gap: 10px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      backdrop-filter: blur(14px);
    }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .row.grow > * { flex: 1; min-width: 140px; }
    label.hint { color: var(--muted); font-size: 0.8rem; display: block; margin-bottom: 4px; }
    input[type="search"], input[type="password"], input[type="text"] {
      width: 100%;
      appearance: none; border: 1px solid var(--line);
      background: rgba(0,0,0,0.28); color: var(--ink);
      font: inherit; padding: 11px 14px; border-radius: 12px; outline: none;
    }
    input:focus { border-color: rgba(61,214,198,0.45); box-shadow: 0 0 0 3px var(--accent-dim); }
    .btn {
      appearance: none; border: 1px solid rgba(61,214,198,0.35);
      background: var(--accent-dim); color: var(--accent);
      font: inherit; font-weight: 600; padding: 11px 16px; border-radius: 12px; cursor: pointer;
      white-space: nowrap;
    }
    .btn:hover { background: rgba(61, 214, 198, 0.28); }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn.ghost { background: transparent; color: var(--ink); border-color: var(--line); }
    .crumbs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 0.85rem; }
    .crumbs strong { color: var(--ink); font-weight: 600; }
    .status {
      min-height: 1.2em; color: var(--muted); font-size: 0.9rem;
    }
    .status.is-err { color: var(--danger); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 14px;
    }
    .card {
      appearance: none; border: 1px solid var(--line); background: rgba(255,255,255,0.03);
      border-radius: 14px; overflow: hidden; cursor: pointer; text-align: left; color: inherit;
      padding: 0; display: grid; transition: transform 0.2s var(--ease), border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: rgba(61,214,198,0.35);
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
    }
    .poster {
      aspect-ratio: 3 / 4;
      width: 100%;
      object-fit: cover;
      background:
        linear-gradient(145deg, rgba(61,214,198,0.12), transparent 50%),
        #12161f;
      display: block;
    }
    .poster.ph {
      display: grid; place-items: center;
      color: var(--muted); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase;
    }
    .meta { padding: 10px 11px 12px; display: grid; gap: 4px; }
    .meta .title {
      font-size: 0.88rem; font-weight: 600; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .meta .sub { color: var(--muted); font-size: 0.75rem; }
    .ep-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .ep-card {
      appearance: none; border: 1px solid var(--line); background: rgba(255,255,255,0.03);
      border-radius: 14px; overflow: hidden; cursor: pointer; text-align: left; color: inherit;
      padding: 0; display: grid; grid-template-columns: 56px 1fr; gap: 0;
      transition: border-color 0.2s ease, transform 0.2s var(--ease);
    }
    .ep-card:hover { border-color: rgba(61,214,198,0.4); transform: translateY(-2px); }
    .ep-card .poster { aspect-ratio: 1; width: 56px; height: 100%; min-height: 72px; }
    .ep-card .meta { padding: 10px 12px; align-content: center; }
    .badge {
      display: inline-block; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; color: #ffb454; background: rgba(255,180,84,0.12);
      padding: 2px 6px; border-radius: 6px; margin-left: 6px;
    }
    .empty {
      padding: 48px 18px; text-align: center; color: var(--muted);
      border: 1px dashed var(--line); border-radius: var(--radius);
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
        <h1 class="brand">ani<span>.</span>watch</h1>
        <p class="brand-by">by <em>wab</em></p>
      </div>
      <div class="nav">
        <a class="pill" href="/">Home</a>
        <button type="button" class="pill is-active" id="browseTab">Browse</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="row grow">
        <div style="flex:1.4;min-width:180px">
          <label class="hint" for="apiKey">API key (x-api-key)</label>
          <input id="apiKey" type="password" autocomplete="off" placeholder="BOT_SECRET_KEY" />
        </div>
        <div style="flex:2;min-width:180px">
          <label class="hint" for="q">Search</label>
          <div class="row">
            <input id="q" type="search" placeholder="One Piece, Citrus…" />
            <button type="button" class="btn" id="searchBtn">Search</button>
          </div>
        </div>
      </div>
      <div class="crumbs" id="crumbs"><span>Search for an anime to begin</span></div>
      <p class="status" id="status"></p>
    </div>

    <main id="main">
      <div class="empty">Enter your API key, then search for a title.</div>
    </main>

    <footer>Posters from HiAnime · episode cards reuse the anime poster · watch opens in a new tab</footer>
  </div>

  <script>
    (function () {
      var apiKey = document.getElementById('apiKey');
      var q = document.getElementById('q');
      var searchBtn = document.getElementById('searchBtn');
      var main = document.getElementById('main');
      var statusEl = document.getElementById('status');
      var crumbs = document.getElementById('crumbs');
      var state = { view: 'home', anime: null };

      apiKey.value = localStorage.getItem('ani.apiKey') || '';
      apiKey.addEventListener('change', function () {
        localStorage.setItem('ani.apiKey', apiKey.value.trim());
      });
      apiKey.addEventListener('blur', function () {
        localStorage.setItem('ani.apiKey', apiKey.value.trim());
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
          throw new Error('Unauthorized — check your API key.');
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

      function posterImg(url, alt) {
        if (url) {
          return '<img class="poster" src="' + esc(url) + '" alt="' + esc(alt || '') + '" loading="lazy" referrerpolicy="no-referrer" />';
        }
        return '<div class="poster ph" aria-hidden="true">No art</div>';
      }

      function setCrumbs(parts) {
        crumbs.innerHTML = parts.map(function (p, i) {
          if (p.action) {
            return '<button type="button" class="pill" data-crumb="' + esc(p.action) + '">' + esc(p.label) + '</button>';
          }
          return '<strong>' + esc(p.label) + '</strong>';
        }).join('<span aria-hidden="true">/</span>');
        crumbs.querySelectorAll('[data-crumb]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var a = btn.getAttribute('data-crumb');
            if (a === 'search') renderSearch(state.lastAnimes || []);
          });
        });
      }

      function renderSearch(animes) {
        state.view = 'search';
        state.anime = null;
        state.lastAnimes = animes;
        setCrumbs([{ label: 'Results (' + animes.length + ')' }]);
        if (!animes.length) {
          main.innerHTML = '<div class="empty">No anime found for that search.</div>';
          return;
        }
        main.innerHTML = '<div class="grid" id="animeGrid"></div>';
        var grid = document.getElementById('animeGrid');
        animes.forEach(function (a) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'card';
          var eps = a.episodes || {};
          var bits = [];
          if (a.type) bits.push(a.type);
          if (eps.sub != null) bits.push('SUB ' + eps.sub);
          if (eps.dub != null) bits.push('DUB ' + eps.dub);
          btn.innerHTML =
            posterImg(a.poster, a.name) +
            '<div class="meta"><div class="title">' + esc(a.name || a.id) + '</div>' +
            '<div class="sub">' + esc(bits.join(' · ') || a.id || '') + '</div></div>';
          btn.addEventListener('click', function () { loadEpisodes(a); });
          grid.appendChild(btn);
        });
      }

      function renderEpisodes(anime, payload) {
        state.view = 'episodes';
        state.anime = anime;
        var episodes = payload.episodes || [];
        var poster = payload.poster || anime.poster || null;
        setCrumbs([
          { label: 'Results', action: 'search' },
          { label: anime.name || anime.id },
        ]);
        if (!episodes.length) {
          main.innerHTML = '<div class="empty">No episodes found.</div>';
          return;
        }
        main.innerHTML = '<div class="ep-grid" id="epGrid"></div>';
        var grid = document.getElementById('epGrid');
        episodes.forEach(function (ep) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ep-card';
          var title = ep.title || ('Episode ' + (ep.number || ''));
          btn.innerHTML =
            posterImg(ep.poster || poster, title) +
            '<div class="meta"><div class="title">Ep ' + esc(ep.number) +
            (ep.isFiller ? '<span class="badge">Filler</span>' : '') +
            '</div><div class="sub">' + esc(title) + '</div></div>';
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
          setStatus('API key required for search.', true);
          return;
        }
        localStorage.setItem('ani.apiKey', apiKey.value.trim());
        searchBtn.disabled = true;
        setStatus('Searching…');
        try {
          var data = await getJson('/api/v2/hianime/search?keyword=' + encodeURIComponent(keyword));
          var animes = data.animes || data.response || [];
          setStatus(animes.length + ' result' + (animes.length === 1 ? '' : 's'));
          renderSearch(animes);
        } catch (err) {
          setStatus(err.message || 'Search failed', true);
        } finally {
          searchBtn.disabled = false;
        }
      }

      async function loadEpisodes(anime) {
        if (!anime || !anime.id) return;
        setStatus('Loading episodes…');
        main.innerHTML = '<div class="empty">Loading episodes…</div>';
        try {
          var data = await getJson('/api/v2/hianime/anime/' + encodeURIComponent(anime.id) + '/episodes');
          setStatus((data.totalEpisodes || (data.episodes || []).length) + ' episodes');
          renderEpisodes(anime, data);
        } catch (err) {
          setStatus(err.message || 'Could not load episodes', true);
          main.innerHTML = '<div class="empty">Could not load episodes.</div>';
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

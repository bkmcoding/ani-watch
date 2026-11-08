import { Context } from 'hono';
import { faviconLinkTags, SITE_NAME, SITE_TAGLINE } from '../../lib/brand';
import { NOTICE_SHORT } from '../../lib/notices';
import { vercelObservabilityScriptTags } from '../../lib/vercelObservability';
import { requestOrigin } from '../../lib/streamUrls';

export const landingController = async (c: Context) => {
  const origin = requestOrigin(c);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>${SITE_NAME} — Private Cinema Streaming</title>
  <meta name="description" content="Explore trending anime, browse episode guides, and stream in crisp HD with Sub/Dub captions — ${SITE_TAGLINE}" />
  ${faviconLinkTags(origin)}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg0: #07090d;
      --bg1: #0d1219;
      --ink: #e8edf5;
      --muted: #8b95a8;
      --accent: #3dd6c6;
      --accent-dim: rgba(61, 214, 198, 0.16);
      --line: rgba(255, 255, 255, 0.1);
      --panel: rgba(12, 16, 24, 0.72);
      --radius-sm: 6px;
      --radius-md: 12px;
      --radius-lg: 18px;
      --radius-pill: 999px;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: var(--bg0);
      color: var(--ink);
      font-family: "DM Sans", system-ui, sans-serif;
    }
    body {
      min-height: 100dvh;
      background:
        radial-gradient(1000px 520px at 18% -8%, rgba(61, 214, 198, 0.18), transparent 55%),
        radial-gradient(900px 520px at 100% 40%, rgba(70, 100, 180, 0.14), transparent 50%),
        linear-gradient(165deg, var(--bg1) 0%, var(--bg0) 48%, #05070a 100%);
    }
    .shell {
      min-height: 100dvh;
      display: grid;
      grid-template-rows: 1fr auto;
    }
    .hero {
      display: grid;
      align-content: center;
      gap: 20px;
      max-width: 920px;
      margin: 0 auto;
      padding: clamp(48px, 12vh, 120px) max(clamp(20px, 5vw, 40px), env(safe-area-inset-right)) 48px max(clamp(20px, 5vw, 40px), env(safe-area-inset-left));
      animation: rise 0.75s var(--ease) both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: none; }
    }
    .brand {
      font-family: Syne, sans-serif;
      font-weight: 800;
      font-size: clamp(1.55rem, 3vw, 2.05rem);
      letter-spacing: -0.035em;
      line-height: 0.95;
      margin: 0;
    }
    .brand a { color: inherit; text-decoration: none; }
    .brand span { color: var(--accent); }
    .byline {
      margin: 0;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: lowercase;
      color: var(--muted);
    }
    .byline em { font-style: normal; color: var(--accent); font-weight: 600; }
    .lede {
      margin: 0;
      max-width: 36rem;
      font-size: 1rem;
      line-height: 1.55;
      color: var(--muted);
    }
    .cta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 6px;
    }
    .btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      border: 1px solid rgba(61, 214, 198, 0.35);
      background: var(--accent-dim);
      color: var(--accent);
      font: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: var(--radius-pill);
      transition: transform 0.2s var(--ease), background 0.2s ease, border-color 0.2s ease;
    }
    .btn:hover {
      transform: translateY(-2px);
      background: rgba(61, 214, 198, 0.28);
      border-color: rgba(61, 214, 198, 0.55);
    }
    .btn:active { transform: scale(0.98); }
    .btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .btn.ghost {
      background: transparent;
      color: var(--ink);
      border-color: var(--line);
    }
    .btn.ghost:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .panel {
      margin-top: 10px;
      padding: 18px 20px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--panel);
      backdrop-filter: blur(14px);
      animation: rise 0.85s var(--ease) 0.08s both;
    }
    .panel h2 {
      margin: 0 0 8px;
      font-family: Syne, sans-serif;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }
    .panel p {
      margin: 0;
      color: var(--muted);
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .panel code {
      font-family: inherit;
      font-weight: 600;
      color: var(--ink);
      background: rgba(255, 255, 255, 0.06);
      padding: 2px 5px;
      border-radius: var(--radius-sm);
    }
    .lede-note {
      margin: 4px 0 0;
      max-width: 36rem;
      font-size: 0.75rem;
      line-height: 1.45;
      color: var(--muted);
      opacity: 0.9;
    }
    .hero-search {
      width: 100%;
      max-width: 640px;
      margin: 4px 0 0;
    }
    .hero-search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      padding: 4px 6px 4px 18px;
      backdrop-filter: blur(14px);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .hero-search-box:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }
    .hero-search-box input[type="search"] {
      flex: 1;
      min-width: 0;
      min-height: 44px;
      background: transparent;
      border: none;
      outline: none;
      color: var(--ink);
      font-family: inherit;
      font-size: 16px;
    }
    .hero-search-box input[type="search"]::placeholder {
      color: var(--muted);
      opacity: 0.8;
    }
    .hero-search-box .btn {
      flex-shrink: 0;
      min-height: 44px;
      padding: 8px 20px;
      cursor: pointer;
    }
    .resume-section {
      width: 100%;
      max-width: 640px;
      animation: rise 0.75s var(--ease) both;
    }
    .resume-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: var(--panel);
      border: 1px solid rgba(61, 214, 198, 0.25);
      border-radius: var(--radius-md);
      backdrop-filter: blur(14px);
    }
    .resume-thumb {
      width: 52px;
      height: 72px;
      object-fit: cover;
      border-radius: var(--radius-sm);
      flex-shrink: 0;
    }
    .resume-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .resume-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .resume-title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .resume-sub {
      margin: 0;
      font-size: 0.75rem;
      color: var(--muted);
    }
    .resume-bar {
      height: 4px;
      width: 100%;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 2px;
    }
    .resume-prog {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    .resume-btn {
      white-space: nowrap;
      flex-shrink: 0;
      min-height: 44px;
      min-width: 44px;
    }
    footer {
      padding: 18px max(clamp(20px, 5vw, 40px), env(safe-area-inset-right)) 28px max(clamp(20px, 5vw, 40px), env(safe-area-inset-left));
      color: var(--muted);
      font-size: 0.75rem;
      text-align: center;
    }
    @media (max-width: 600px) {
      .hero-search-box {
        padding-left: 14px;
      }
      .hero-search-box input[type="search"] {
        font-size: 16px !important;
      }
      .resume-card {
        flex-wrap: wrap;
        gap: 12px;
      }
      .resume-btn {
        width: 100%;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      body { animation: none; }
      .hero, .panel, .btn, .resume-section {
        animation: none;
        transition: none;
        transform: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <main class="hero">
      <h1 class="brand"><a href="/">ani<span>.</span>watch</a></h1>
      <p class="byline">by <em>wab</em></p>
      <p class="lede">Private, theater-grade anime streaming. Browse catalog titles, explore curated rails, and unlock high-definition Sub/Dub playback with your instance access key.</p>
      <form class="hero-search" action="/browse" method="get">
        <div class="hero-search-box">
          <input type="search" name="q" placeholder="Search anime by title, e.g. Frieren, Solo Leveling, Bleach…" autocomplete="off" required />
          <button type="submit" class="btn" aria-label="Search">Search</button>
        </div>
      </form>
      <div class="resume-section" id="resumeSection" style="display: none;"></div>
      <div class="cta">
        <a class="btn" href="/browse">Discover anime</a>
        <a class="btn ghost" href="/browse?cat=most-popular">Popular</a>
        <a class="btn ghost" href="/browse?cat=top-airing">Top airing</a>
        <a class="btn ghost" href="/api">API docs</a>
      </div>
      <section class="panel">
        <h2>Instance Security &amp; Access Key</h2>
        <p>Playback streams and upstream resolvers are secured by design. Catalog exploration and episode guides are open to browse, while video playback requires an <code>x-api-key</code> configured on your instance. Enter your key on the browse dock to unlock the cinema player.</p>
      </section>
      <p class="lede-note">${NOTICE_SHORT}</p>
    </main>
    <footer>${SITE_NAME} · ${SITE_TAGLINE} · cinema streaming</footer>
  </div>
  <script>
    (function () {
      try {
        var raw = localStorage.getItem('ani.cw');
        if (!raw) return;
        var list = JSON.parse(raw);
        if (!list || !list.length) return;
        var item = list[0];
        if (!item || (!item.id && !item.href)) return;
        var sec = document.getElementById('resumeSection');
        if (!sec) return;
        var dur = item.dur || 0;
        var time = item.time || item.t || 0;
        var pct = dur > 0 ? Math.min(100, Math.round((time / dur) * 100)) : 0;
        var watchUrl = item.href || ('/watch?animeId=' + encodeURIComponent(item.id) + (item.epId ? '&episodeId=' + encodeURIComponent(item.epId) : ''));
        var posterUrl = item.poster;
        if (!posterUrl && item.id) {
          try {
            var meta = JSON.parse(localStorage.getItem('ani.meta.' + item.id) || 'null');
            if (meta && meta.poster) posterUrl = meta.poster;
          } catch (e) {}
        }
        function esc(s) {
          return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        var poster = posterUrl ? '<img src="' + esc(posterUrl) + '" alt="" class="resume-thumb" />' : '';
        var title = esc(item.title || item.name || item.id || 'Anime');
        var epNum = esc(String(item.epNum || 1));
        sec.innerHTML =
          '<div class="resume-card">' +
            poster +
            '<div class="resume-info">' +
              '<span class="resume-label">Continue Watching</span>' +
              '<h3 class="resume-title">' + title + '</h3>' +
              '<p class="resume-sub">Episode ' + epNum + (pct > 0 ? ' · ' + pct + '% complete' : '') + '</p>' +
              '<div class="resume-bar"><div class="resume-prog" style="width:' + pct + '%;"></div></div>' +
            '</div>' +
            '<a class="btn resume-btn" href="' + esc(watchUrl) + '">▶ Resume</a>' +
          '</div>';
        sec.style.display = 'block';
      } catch (e) {}
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

export default landingController;

import { Context } from 'hono';

const landingController = async (_c: Context) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>ani.watch — by wab</title>
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
      --line: rgba(255, 255, 255, 0.12);
      --panel: rgba(14, 18, 26, 0.72);
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg0); color: var(--ink); font-family: "DM Sans", system-ui, sans-serif; }
    body {
      min-height: 100dvh;
      background:
        radial-gradient(1100px 560px at 50% -8%, rgba(61, 214, 198, 0.14), transparent 55%),
        radial-gradient(800px 480px at 100% 100%, rgba(80, 110, 180, 0.12), transparent 50%),
        linear-gradient(180deg, #0d1118 0%, var(--bg0) 42%, #080a0e 100%);
    }
    .wrap {
      max-width: 920px;
      margin: 0 auto;
      padding: clamp(28px, 5vw, 56px) clamp(18px, 4vw, 28px) 48px;
    }
    .hero {
      display: grid;
      gap: 18px;
      padding: clamp(28px, 5vw, 48px) 0 36px;
      animation: rise 0.7s var(--ease) both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: none; }
    }
    .brand {
      font-family: Syne, sans-serif;
      font-weight: 700;
      font-size: clamp(2.6rem, 8vw, 4.4rem);
      letter-spacing: -0.04em;
      line-height: 0.95;
      margin: 0;
    }
    .brand span { color: var(--accent); }
    .brand-by {
      margin: 0;
      font-size: 0.95rem;
      letter-spacing: 0.08em;
      text-transform: lowercase;
      color: var(--muted);
    }
    .brand-by em { font-style: normal; color: var(--accent); font-weight: 600; }
    .lede {
      margin: 0;
      max-width: 36rem;
      font-size: 1.08rem;
      line-height: 1.55;
      color: var(--muted);
    }
    .cta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
    .btn {
      appearance: none; border: 1px solid var(--line);
      background: var(--accent-dim); color: var(--accent);
      font: inherit; font-weight: 600; text-decoration: none;
      padding: 12px 18px; border-radius: 999px;
      transition: background 0.2s ease, transform 0.2s var(--ease), border-color 0.2s ease;
    }
    .btn:hover { background: rgba(61, 214, 198, 0.28); border-color: rgba(61, 214, 198, 0.45); transform: translateY(-1px); }
    .btn.ghost { background: transparent; color: var(--ink); }
    .btn.ghost:hover { background: rgba(255,255,255,0.05); border-color: var(--line); }
    section {
      margin-top: 28px;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--panel);
      backdrop-filter: blur(12px);
      animation: rise 0.8s var(--ease) 0.08s both;
    }
    h2 {
      margin: 0 0 14px;
      font-family: Syne, sans-serif;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }
    p.note { margin: 0 0 14px; color: var(--muted); font-size: 0.92rem; line-height: 1.5; }
    .routes { display: grid; gap: 10px; }
    .route {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px 14px;
      align-items: start;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid transparent;
    }
    .route:hover { border-color: var(--line); }
    .method {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--accent);
      background: var(--accent-dim);
      padding: 5px 8px;
      border-radius: 8px;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.86rem;
      color: var(--ink);
      word-break: break-all;
    }
    .desc { grid-column: 2; color: var(--muted); font-size: 0.86rem; margin: 0; }
    footer {
      margin-top: 28px;
      color: var(--muted);
      font-size: 0.8rem;
      animation: rise 0.8s var(--ease) 0.14s both;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1 class="brand">ani<span>.</span>watch</h1>
      <p class="brand-by">by <em>wab</em></p>
      <p class="lede">Search anime, pick an episode, and play Sub/Dub streams — same flow as ani-cli, in the browser.</p>
      <div class="cta-row">
        <a class="btn" href="/browse">Open browse</a>
        <a class="btn ghost" href="/ping">Health check</a>
      </div>
    </header>

    <section>
      <h2>API</h2>
      <p class="note">JSON routes under <code>/api/v2</code> require header <code>x-api-key</code> (your <code>BOT_SECRET_KEY</code>). The watch player and HLS proxy stay public.</p>
      <div class="routes">
        <div class="route">
          <span class="method">GET</span>
          <code>/api/v2/hianime/search?keyword=</code>
          <p class="desc">Search anime (includes poster URLs).</p>
        </div>
        <div class="route">
          <span class="method">GET</span>
          <code>/api/v2/hianime/anime/:id/episodes</code>
          <p class="desc">Episode list with shared anime poster.</p>
        </div>
        <div class="route">
          <span class="method">GET</span>
          <code>/api/v2/hianime/episode/sources?animeEpisodeId=&amp;category=</code>
          <p class="desc">Resolve Sub/Dub streams and a /watch link.</p>
        </div>
        <div class="route">
          <span class="method">GET</span>
          <code>/api/v2/hianime/watch</code>
          <p class="desc">Browser player (Sub/Dub, CC, theater).</p>
        </div>
        <div class="route">
          <span class="method">GET</span>
          <code>/ping</code>
          <p class="desc">Service health JSON.</p>
        </div>
      </div>
    </section>

    <footer>ani.watch · by wab</footer>
  </div>
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

import { Context } from 'hono';
import { faviconLinkTags, SITE_NAME, SITE_TAGLINE } from '../../lib/brand';
import { NOTICE_SHORT } from '../../lib/notices';
import { vercelObservabilityScriptTags } from '../../lib/vercelObservability';
import { requestOrigin } from '../../lib/streamUrls';

const landingController = async (c: Context) => {
  const origin = requestOrigin(c);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>${SITE_NAME}</title>
  <meta name="description" content="Discover trending and new anime, then watch Sub/Dub streams — ${SITE_TAGLINE}" />
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
      --line: rgba(255, 255, 255, 0.1);
      --panel: rgba(12, 16, 24, 0.72);
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg0); color: var(--ink); font-family: "DM Sans", system-ui, sans-serif; }
    body {
      min-height: 100dvh;
      background:
        radial-gradient(1000px 520px at 18% -8%, rgba(61, 214, 198, 0.18), transparent 55%),
        radial-gradient(900px 520px at 100% 40%, rgba(70, 100, 180, 0.14), transparent 50%),
        linear-gradient(165deg, #0d1219 0%, var(--bg0) 48%, #05070a 100%);
    }
    .shell {
      min-height: 100dvh;
      display: grid;
      grid-template-rows: 1fr auto;
    }
    .hero {
      display: grid;
      align-content: center;
      gap: 22px;
      max-width: 920px;
      margin: 0 auto;
      padding: clamp(48px, 12vh, 120px) clamp(20px, 5vw, 40px) 48px;
      animation: rise 0.75s var(--ease) both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: none; }
    }
    .brand {
      font-family: Syne, sans-serif;
      font-weight: 800;
      font-size: clamp(3rem, 11vw, 5.4rem);
      letter-spacing: -0.045em;
      line-height: 0.92;
      margin: 0;
    }
    .brand span { color: var(--accent); }
    .byline {
      margin: 0;
      font-size: 1rem;
      letter-spacing: 0.08em;
      text-transform: lowercase;
      color: var(--muted);
    }
    .byline em { font-style: normal; color: var(--accent); font-weight: 600; }
    .lede {
      margin: 0;
      max-width: 34rem;
      font-size: clamp(1.05rem, 2.2vw, 1.2rem);
      line-height: 1.55;
      color: var(--muted);
    }
    .cta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 8px;
    }
    .btn {
      appearance: none;
      border: 1px solid rgba(61, 214, 198, 0.35);
      background: var(--accent-dim);
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      text-decoration: none;
      padding: 13px 20px;
      border-radius: 999px;
      transition: transform 0.2s var(--ease), background 0.2s ease, border-color 0.2s ease;
    }
    .btn:hover {
      transform: translateY(-2px);
      background: rgba(61, 214, 198, 0.28);
      border-color: rgba(61, 214, 198, 0.55);
    }
    .btn.ghost {
      background: transparent;
      color: var(--ink);
      border-color: var(--line);
    }
    .btn.ghost:hover { background: rgba(255,255,255,0.05); }
    .panel {
      margin-top: 10px;
      padding: 18px 20px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--panel);
      backdrop-filter: blur(14px);
      animation: rise 0.85s var(--ease) 0.08s both;
    }
    .panel h2 {
      margin: 0 0 8px;
      font-family: Syne, sans-serif;
      font-size: 0.95rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }
    .panel p {
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .panel code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.84em;
      color: var(--ink);
    }
    .lede-note {
      margin: 4px 0 0;
      max-width: 36rem;
      font-size: 0.85rem;
      line-height: 1.45;
      color: var(--muted);
      opacity: 0.9;
    }
    footer {
      padding: 18px clamp(20px, 5vw, 40px) 28px;
      color: var(--muted);
      font-size: 0.8rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="shell">
    <main class="hero">
      <h1 class="brand">ani<span>.</span>watch</h1>
      <p class="byline">by <em>wab</em></p>
      <p class="lede">Browse trending and latest episodes, pick a title, and play Sub/Dub with captions — the same flow as the API, in the browser.</p>
      <div class="cta">
        <a class="btn" href="/browse">Trending &amp; new</a>
        <a class="btn ghost" href="/browse">Search titles</a>
        <a class="btn ghost" href="/api">API index</a>
      </div>
      <section class="panel">
        <h2>API access</h2>
        <p>JSON routes under <code>/api/v2</code> need header <code>x-api-key</code>. Browse uses that key once (saved locally) to load Discover rails and category pages. Watch, play, and HLS stay public.</p>
      </section>
      <p class="lede-note">${NOTICE_SHORT}</p>
    </main>
    <footer>${SITE_NAME} · ${SITE_TAGLINE}</footer>
  </div>
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

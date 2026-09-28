<div align="center">
  <img src="docs/logo.svg" alt="ani.watch" width="128" height="128" />

  <h1>ani.watch</h1>

  <p><strong>by wab</strong> — educational scrape API + browse UI + HTML player</p>

  <p>
    <img alt="version" src="https://img.shields.io/badge/version-2.2.0-3dd6c6?style=flat-square" />
    <img alt="license" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white" />
    <img alt="Hono" src="https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white" />
  </p>

  <p>
    <a href="#disclaimer">Disclaimer</a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="#auth">Auth</a> ·
    <a href="#main-endpoints">Endpoints</a> ·
    <a href="#deploy">Deploy</a> ·
    <a href="docs/cloudflare-media-proxy.md">Media proxy</a>
  </p>
</div>

---

## Disclaimer

Unofficial educational project for demonstrating scrape-backed APIs and a simple player UI.

- Not affiliated with any anime site or rights holders
- Does not host or own media; third-party sources only
- No rights to content are granted; use at your own risk and follow local law

---

## Features

- JSON API under `/api/v2` (catalog, episodes, sources)
- Public HTML: `/` · `/browse` · `/api/v2/hianime/watch`
- Episode Prev/Next + in-player episode list
- Optional Cloudflare Worker for HLS/poster proxy

---

## Quick start

**Requirements:** Node 20+ or [Bun](https://bun.sh), and a `BOT_SECRET_KEY` for protected JSON routes.

```bash
cp .env.example .env
# set BOT_SECRET_KEY=...

npm install
npm run dev          # or: bun run --hot index.ts
```

Open [`http://localhost:5000/`](http://localhost:5000/) and [`http://localhost:5000/browse`](http://localhost:5000/browse).

### Environment

See [`.env.example`](.env.example):

| Variable | Purpose |
| --- | --- |
| `BOT_SECRET_KEY` | `x-api-key` for `/api/v2` JSON (except public watch/media) |
| `BASE_URL` | Upstream scrape origin (third-party site) |
| `CORS_ORIGIN` | CORS allowlist (`*` default) |
| `PORT` | Local port (default `5000`) |
| `MEDIA_PROXY_ORIGIN` | Optional Worker origin for HLS/posters |
| `MEDIA_PROXY_SECRET` | Shared secret for media proxy `k=` |

---

## Auth

| Surface | Access |
| --- | --- |
| Most `/api/v2/*` JSON | Header `x-api-key: <BOT_SECRET_KEY>` |
| `/watch`, `/watch/play`, `/watch/episodes`, `/hls`, `/poster` | Public |

---

## Typical flow

```text
GET /api/v2/hianime/search?keyword=...
GET /api/v2/hianime/anime/:id/episodes
GET /api/v2/hianime/episode/sources?animeEpisodeId=...&category=sub
→ open data.link (HTML player)
→ Prev/Next or episode picker via /watch/play and /watch/episodes
```

Machine-readable catalog: [`GET /api`](/api).

---

## Main endpoints

| Path | Notes |
| --- | --- |
| `GET /` | Landing |
| `GET /browse` | Search UI (API key in tab) |
| `GET /api` | Endpoint index |
| `GET /ping` | Health |
| `GET /api/v2/hianime/search?keyword=` | Search |
| `GET /api/v2/anime/:id` | Detail |
| `GET /api/v2/hianime/anime/:id/episodes` | Episode list |
| `GET /api/v2/hianime/episode/servers?animeEpisodeId=` | Servers |
| `GET /api/v2/hianime/episode/sources?animeEpisodeId=&category=` | Streams + watch link |
| `GET /api/v2/hianime/watch` | HTML player |
| `GET /api/v2/hianime/watch/play?animeEpisodeId=&category=` | Resolve + redirect to watch |
| `GET /api/v2/hianime/watch/episodes?anime=` | Compact public episode list |
| `GET /api/v2/hianime/hls?url=` | HLS proxy |
| `GET /api/v2/hianime/poster?url=` | Poster proxy |

Aliases such as `/api/v2/home`, `/api/v2/search`, and list/filter/schedule routes remain for compatibility.

---

## Project layout

```text
src/
  app.ts              # Hono app
  server.ts           # Bun entry
  routes/v2.ts        # /api/v2 routes
  handlers/           # pages | catalog | playback | media
  extractors/         # HTML parsers
  services/           # HTTP + stream providers
  lib/                # shared helpers
workers/media-proxy/  # Cloudflare Worker
tests/                # Vitest
docs/                 # logo + deploy notes
```

---

## Scripts

```bash
npm run dev           # local Bun server
npm run type-check
npm test              # Vitest
npm run vercel-build  # bundle → api/index.js
```

---

## Deploy

**Vercel (primary)** — connect the GitHub repo; build uses `vercel-build`. Set `BOT_SECRET_KEY` (and optional `MEDIA_PROXY_*`) in project env.

**Cloudflare media proxy** — see [docs/cloudflare-media-proxy.md](docs/cloudflare-media-proxy.md).

**Docker** — optional `Dockerfile` for self-hosting; not required for Vercel.

---

<div align="center">

**License** — see [LICENSE](LICENSE)

</div>

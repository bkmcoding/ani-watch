# Cloudflare media proxy setup

Move HLS video segments and poster images off Vercel onto a **Cloudflare Worker** so Fast Origin Transfer stays under the free 10 GB limit.

Until `MEDIA_PROXY_ORIGIN` is set on Vercel, the app keeps using Vercel `/api/v2/hianime/hls` and `/poster` (current behavior).

---

## What you need

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account
- Node.js 18+ and npm (for Wrangler)
- Access to your Vercel project env vars
- Worker source already in this repo: [`workers/media-proxy/`](../workers/media-proxy/)

---

## 1. Install Wrangler + deploy deps

From the repo root:

```bash
cd workers/media-proxy
npm install
npx wrangler login
```

(Browser opens — approve with your Cloudflare account.)

---

## 2. Deploy the Worker

Still in `workers/media-proxy`:

```bash
npx wrangler deploy
```

Or: `npm run deploy`

Wrangler prints a URL like:

```text
https://hianime-media-proxy.<your-subdomain>.workers.dev
```

Copy that origin **without a trailing slash**. Example:

```text
https://hianime-media-proxy.myaccount.workers.dev
```

### Optional: custom name

Edit [`workers/media-proxy/wrangler.toml`](../workers/media-proxy/wrangler.toml) (`name = "..."`) before deploying if you want a different Worker name / URL.

### Redeploy after code changes

```bash
cd workers/media-proxy
npx wrangler deploy
```

---

## 3. Smoke-test the Worker

Replace `WORKER` with your origin:

```bash
# Should return 400 / validation error without url= (proves the Worker is up)
curl -i "$WORKER/hls"

# Poster probe (use any allowlisted poster URL your API already returns)
curl -i "$WORKER/poster?url=https://example-allowed-cdn/poster.jpg"
```

A healthy Worker responds quickly; `502` usually means the upstream CDN blocked the fetch (wrong host or Referer), not a Wrangler misconfig.

---

## 4. Point Vercel at the Worker

In the [Vercel dashboard](https://vercel.com/dashboard) → your project → **Settings** → **Environment Variables**:

| Name | Value | Environments |
| --- | --- | --- |
| `MEDIA_PROXY_ORIGIN` | `https://hianime-media-proxy.<subdomain>.workers.dev` | Production (and Preview if you want) |

Rules:

- Use `https://`
- **No** trailing slash
- Do **not** include `/hls` or `/poster` in the value — the app appends those paths

Redeploy the Vercel project so the new env var is picked up (Deployments → … → Redeploy, or push a commit).

### Local / Bun dev

Create or edit `.env` / `.env.local`:

```env
MEDIA_PROXY_ORIGIN=https://hianime-media-proxy.<subdomain>.workers.dev
```

Restart the dev server. Omit the var to keep using local Vercel-style `/hls` on the same origin.

---

## 5. Verify end-to-end

1. Open browse → play an episode.
2. In DevTools → Network, confirm media requests go to **`*.workers.dev/hls?url=...`**, not your Vercel host `/api/v2/hianime/hls`.
3. Posters on browse should hit **`*.workers.dev/poster?url=...`** when proxied.
4. In Vercel → Usage, Fast Origin Transfer should stop climbing during playback (only HTML/JSON should remain).

---

## Free tier reminder

Cloudflare Workers **Free**:

- **100,000 requests / day** (each HLS segment counts as one request)
- Roughly **~200–250 full episode watches / day** before the cap
- **No Vercel-style GB egress bill** for Worker responses
- **10 ms CPU** per request — fine for streaming; heavy buffering can hit the limit

If you outgrow free requests, Workers **Paid** (~$5/mo) is usually cheaper than buying Vercel bandwidth.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Watch still hits Vercel `/hls` | `MEDIA_PROXY_ORIGIN` missing, typo, or Vercel not redeployed |
| Worker `url host not allowed` | CDN host not in the Worker allowlist (same list as the API) |
| Black screen / stuck loading | Upstream blocked; check Worker logs: `npx wrangler tail` |
| Works locally, fails in prod | Env var set only on Preview, not Production (or vice versa) |
| Daily 100k errors | Hit free request cap; wait for reset or upgrade to Paid |

---

## Rollback

1. Remove `MEDIA_PROXY_ORIGIN` from Vercel (or set it empty).
2. Redeploy.

The API falls back to same-origin `/api/v2/hianime/hls` and `/poster` on Vercel again.

---

## Security notes

- The Worker only proxies **allowlisted** stream/poster hosts (same idea as the API).
- Anyone who knows the Worker URL can burn your request quota — treat a public `*.workers.dev` link as semi-public. If abuse appears, add a shared secret header/query later and send it from the API when minting proxy URLs.

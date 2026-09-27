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
# Should return 401 once MEDIA_PROXY_SECRET is set on the Worker
curl -i "$WORKER/hls?url=https://example.com/x.m3u8"

# With key (use a real allowlisted upstream URL)
curl -i "$WORKER/hls?url=URL&k=YOUR_SECRET"
```

A healthy Worker responds quickly; `502` usually means the upstream CDN blocked the fetch (wrong host or Referer), not a Wrangler misconfig.

---

## 4. Point Vercel at the Worker + set the shared secret

Generate a long random secret (example):

```bash
openssl rand -hex 24
```

### A. Cloudflare Worker secret

From `workers/media-proxy`:

```bash
npx wrangler secret put MEDIA_PROXY_SECRET
```

Paste the same secret when prompted. Redeploy if needed:

```bash
npx wrangler deploy
```

### B. Vercel project env vars

| Name | Value | Environments |
| --- | --- | --- |
| `MEDIA_PROXY_ORIGIN` | `https://hianime-media-proxy.<subdomain>.workers.dev` | Production (and Preview if you want) |
| `MEDIA_PROXY_SECRET` | *(same secret as Wrangler)* | Production (and Preview if you want) |

Rules for `MEDIA_PROXY_ORIGIN`:

- Use `https://`
- **No** trailing slash
- Do **not** include `/hls` or `/poster` — the app appends those paths

Redeploy the Vercel project so both env vars are picked up.

### Local / Bun dev

```env
MEDIA_PROXY_ORIGIN=https://hianime-media-proxy.<subdomain>.workers.dev
MEDIA_PROXY_SECRET=your-same-secret
```

If `MEDIA_PROXY_SECRET` is unset on both sides, proxies stay open (dev only). Once set on the Worker, requests without `k=` return **401**.

---

## 5. Verify end-to-end

1. Open browse → play an episode.
2. In DevTools → Network, confirm media requests go to **`*.workers.dev/hls?url=...&k=...`**, not your Vercel host `/api/v2/hianime/hls`.
3. Posters on browse (fallback path) should hit **`*.workers.dev/poster?url=...&k=...`**.
4. Hitting the Worker without `k` should return **401**.
5. In Vercel → Usage, Fast Origin Transfer should stop climbing during playback (only HTML/JSON should remain).

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
| `401` / invalid media proxy key | Secret missing/mismatched between Vercel and Wrangler |
| Worker `url host not allowed` | CDN host not in the Worker allowlist (same list as the API) |
| Black screen / stuck loading | Upstream blocked; check Worker logs: `npx wrangler tail` |
| Works locally, fails in prod | Env var set only on Preview, not Production (or vice versa) |
| Daily 100k errors | Hit free request cap; wait for reset or upgrade to Paid |

---

## Rollback

1. Remove `MEDIA_PROXY_ORIGIN` from Vercel (or set it empty).
2. Optionally remove `MEDIA_PROXY_SECRET` from Vercel and delete the Worker secret.
3. Redeploy.

The API falls back to same-origin `/api/v2/hianime/hls` and `/poster` on Vercel again.

---

## Security notes

- The Worker only proxies **allowlisted** stream/poster hosts (same idea as the API).
- `MEDIA_PROXY_SECRET` is sent as query `k=` (required for `<video>` / `<img>` / HLS.js). It will appear in browser Network tabs — it stops casual quota abuse, not a determined scraper who already has a watch URL.
- Keep the secret long and random; rotate by updating Wrangler + Vercel together, then redeploy both.
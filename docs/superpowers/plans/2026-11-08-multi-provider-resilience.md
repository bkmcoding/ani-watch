# Multi-Provider Resilience & In-Player Server Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a resilient tri-provider streaming architecture (HiAnime HD-1/HD-2, ZokoAnime, and GogoAnime) paired with a clean, zero-reload in-player server switcher and self-healing auto-failover.

**Architecture:** Providers are decoupled into distinct resolvers returning standardized `ProviderStreamResult` objects with server-scoped caching (`stream:${episodeId}:${category}:${server}`). The watch player provides an under-stage server bar and an in-menu server section, seamlessly hot-swapping Hls.js manifests while preserving playback timestamps and user settings, with automated failover on CDN stalls or 403 errors.

**Tech Stack:** TypeScript, Hono, Cheerio, Node.js Crypto (AES-256-CBC, XOR), Hls.js, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-08-multi-provider-resilience-design.md`](file:///c:/Users/orkar/Documents/GitHub/ani-watch/docs/superpowers/specs/2026-11-08-multi-provider-resilience-design.md)

## Global Constraints
- Every server resolution must be non-blocking and fail gracefully rather than throwing 500 errors.
- Switching servers in the video player must never trigger a full page reload or drop user volume/time.
- Touch targets for all interactive server pills must be $\ge 44\times 44$px on mobile.
- All Hono HTML controller templates must remain dependency-free at client runtime.
- Recompile Vercel production bundle via `node build-vercel.mjs` before concluding implementation.

---

### Task 1: Decouple HD-1 and HD-2 in MegaPlay Resolver

**Files:**
- Modify: `src/services/megaplay.ts`
- Test: `tests/services/megaplayServers.test.ts`

**Interfaces:**
- Consumes: `parseThemeServers`, `ThemeServer` from `src/services/megaplay.ts`
- Produces: `pickServer(servers, 'hd-1' | 'hd-2', category)` returning distinct, non-overlapping `ThemeServer` matches.

- [ ] **Step 1: Write failing test in `tests/services/megaplayServers.test.ts`**
  Assert that when both `HD-1` and `HD-2` exist in theme servers, `pickServer(servers, 'hd-1', 'sub')` strictly returns the HD-1 entry and `pickServer(servers, 'hd-2', 'sub')` strictly returns the HD-2 entry without falling back across each other prematurely.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/services/megaplayServers.test.ts`
- [ ] **Step 3: Update `pickServer` in `src/services/megaplay.ts`**
  Refine server matching in `pickServer` so that explicit requests for `hd-1` or `hd-2` match their respective server name patterns without defaulting to HD-1 when HD-2 is explicitly requested.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/services/megaplayServers.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(megaplay): strictly decouple HD-1 and HD-2 server selection"`

---

### Task 2: Implement GogoAnime Fallback Scraper Service

**Files:**
- Create: `src/services/gogoanime.ts`
- Test: `tests/services/gogoanime.test.ts`

**Interfaces:**
- Consumes: `config.headers['User-Agent']`
- Produces: `resolveGogoSources(animeTitle: string, epNum: number | string): Promise<GogoStreamResult | null>`

- [ ] **Step 1: Write failing test in `tests/services/gogoanime.test.ts`**
  Test `resolveGogoSources` against mock GogoAnime search results and streaming embed pages, asserting extracted HLS `.m3u8` stream sources and referer headers.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/services/gogoanime.test.ts`
- [ ] **Step 3: Implement `src/services/gogoanime.ts`**
  Implement search query normalization, episode URL resolution, embed iframe extraction, and Ajax HLS decryption with timeout guards (`signal: AbortSignal.timeout(12000)`).
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/services/gogoanime.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(providers): implement GogoAnime fallback scraper service"`

---

### Task 3: Tri-Provider Routing & Cache Partitioning in `episodeSources.ts`

**Files:**
- Modify: `src/services/episodeSources.ts`
- Test: `tests/services/episodeSourcesMulti.test.ts`

**Interfaces:**
- Consumes: `megaplay.ts`, `zoko.ts`, `gogoanime.ts`
- Produces: `resolveCategory(servers, category, server, episodeId, animeTitle)` supporting `hd-1`, `hd-2`, `zoko`, and `gogo` with isolated cache keys `stream:${episodeId}:${category}:${server}`.

- [ ] **Step 1: Write failing test in `tests/services/episodeSourcesMulti.test.ts`**
  Test distinct resolution for `hd-1`, `hd-2`, `zoko`, and `gogo`, verifying independent cache entries and automatic fallback chain when a server fails.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/services/episodeSourcesMulti.test.ts`
- [ ] **Step 3: Update `src/services/episodeSources.ts`**
  Update `resolveCategory`, `detectProvider`, `buildAvailableProviders`, and `resolveEpisodePlayback` to include GogoAnime as a recognized provider and treat `hd-1` and `hd-2` as distinct selectable servers.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/services/episodeSourcesMulti.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(episodeSources): support tri-provider routing and isolated cache partitions"`

---

### Task 4: Enriched Servers & Sources Endpoints

**Files:**
- Modify: `src/handlers/playback/servers.ts`
- Modify: `src/handlers/playback/sources.ts`
- Modify: `src/handlers/pages/watchPlay.ts`
- Test: `tests/handlers/serversMulti.test.ts`

**Interfaces:**
- Consumes: `resolveEpisodePlayback`, `buildAvailableProviders`
- Produces: Normalized server objects with `label`, `provider`, `preferred`, and tolerant fallback routing.

- [ ] **Step 1: Write failing test in `tests/handlers/serversMulti.test.ts`**
  Assert `/api/v2/hianime/episode/servers` returns enriched server metadata including `hd-1`, `hd-2`, `zoko`, and `gogo` with friendly labels.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/serversMulti.test.ts`
- [ ] **Step 3: Update server and source handlers**
  Update `serversController`, `sourcesController`, and `watchPlayController` to return and preserve server parameters across redirects.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/serversMulti.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(api): enrich episode servers and sources with multi-provider metadata"`

---

### Task 5: Watch Player Server Bar & In-Menu Server Selector UI

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Test: `tests/handlers/watchServerSwitcherUI.test.ts`

**Interfaces:**
- Consumes: Server metadata in HTML template
- Produces: `.server-bar` element under `#stage`, `#serverSection` inside `#settingsMenu`, and responsive styling.

- [ ] **Step 1: Write failing test in `tests/handlers/watchServerSwitcherUI.test.ts`**
  Assert watch page HTML contains `.server-bar` with server pills, active status dot, and `#serverSection` inside settings menu.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/watchServerSwitcherUI.test.ts`
- [ ] **Step 3: Implement server UI components in `src/handlers/pages/watch.ts`**
  Add CSS and markup for `.server-bar`, `.server-chips`, `.server-chip`, `.status-dot`, and `#serverSection` in settings, with automatic filtering when toggling Sub/Dub.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/watchServerSwitcherUI.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(watch): render under-stage server bar and settings server selector"`

---

### Task 6: Zero-Reload Stream Hot-Swapping & Self-Healing Auto-Failover

**Files:**
- Modify: `src/handlers/pages/watch.ts`
- Test: `tests/handlers/watchStreamHotSwap.test.ts`

**Interfaces:**
- Consumes: Client `hls` instance, `/api/v2/hianime/episode/sources`
- Produces: `switchServer(newServer)` with time/volume preservation, OSD feedback, and automated failover on fatal network errors.

- [ ] **Step 1: Write failing test in `tests/handlers/watchStreamHotSwap.test.ts`**
  Assert client script in `watch.ts` contains `switchServer` function, `Hls.Events.ERROR` failover handler, and local storage server preference persistence.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/watchStreamHotSwap.test.ts`
- [ ] **Step 3: Implement hot-swapping and auto-failover in `src/handlers/pages/watch.ts`**
  Implement client-side stream switching, state retention, Hls.js error interceptor, and recovery overlay when all servers fail.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/watchStreamHotSwap.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(watch): implement zero-reload stream hot-swapping and auto-failover"`

---

### Task 7: Browse Page Cinema Player Preferred Server Integration

**Files:**
- Modify: `src/handlers/pages/browse.ts`
- Test: `tests/handlers/browseServerIntegration.test.ts`

**Interfaces:**
- Consumes: `ani.preferredServer` in `localStorage`
- Produces: `playEpisode` passing preferred server into source resolver and iframe URL with pre-flight fallback.

- [ ] **Step 1: Write failing test in `tests/handlers/browseServerIntegration.test.ts`**
  Assert `browse.ts` client script reads `ani.preferredServer` and passes server into episode source resolution.
- [ ] **Step 2: Run test to confirm failure**
  Run: `npx vitest run tests/handlers/browseServerIntegration.test.ts`
- [ ] **Step 3: Update `src/handlers/pages/browse.ts`**
  Update `playEpisode` in `browse.ts` to read preferred server from `localStorage` and implement pre-flight fallback across servers if the preferred server fails.
- [ ] **Step 4: Run test to confirm pass**
  Run: `npx vitest run tests/handlers/browseServerIntegration.test.ts`
- [ ] **Step 5: Commit changes**
  Commit: `git commit -am "feat(browse): integrate preferred server routing and fallback in cinema player"`

---

### Task 8: Production Build & Full Verification

**Files:**
- Modify: `api/index.js` (recompiled bundle)

- [ ] **Step 1: Run full unit test suite**
  Run: `npm test`
- [ ] **Step 2: Run TypeScript type check**
  Run: `npm run type-check`
- [ ] **Step 3: Run Playwright mobile test suite**
  Run: `npm run test:mobile`
- [ ] **Step 4: Recompile Vercel production bundle**
  Run: `node build-vercel.mjs`
- [ ] **Step 5: Commit bundle and finalize branch**
  Commit: `git commit -am "build: recompile Vercel bundle for multi-provider resilience"`

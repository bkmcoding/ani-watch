# Design Specification: Multi-Provider Resilience & In-Player Server Switching

- **Date:** 2026-11-08
- **Status:** Approved
- **Target Surfaces:** Backend Provider Resolvers (`src/services/`), API Endpoints (`src/handlers/playback/`), Watch Player (`src/handlers/pages/watch.ts`), Browse Catalog (`src/handlers/pages/browse.ts`)

---

## 1. Problem Statement & Goals

### 1.1 Context & Background
In `ani-watch`, stream playback currently depends on a single hardcoded server choice (`server: 'hd-1'`), routing through HiAnime/MegaPlay with an internal invisible fallback to Zoko. The player interface exposes no user-facing server selection controls—only a static read-only badge indicating the provider name.

When upstream CDN tokens expire, or when MegaCloud / RapidCloud encounters network stalls, rate limits, or regional blocking, viewers face unrecoverable errors ("Could not load SUB. Try another server") with zero interactive means to choose an alternative server or recover playback.

### 1.2 Core Goals
1. **Tri-Provider Resilience**: Decouple and expose 3 distinct upstream providers and 4 selectable servers:
   - **HiAnime HD-1** (MegaCloud / VidStreaming)
   - **HiAnime HD-2** (RapidCloud / VidCloud)
   - **ZokoAnime** (Otaku XOR deobfuscator)
   - **GogoAnime** (Independent fallback scraper for Vidcdn / Ajax streams)
2. **First-Class In-Player Server Switcher**:
   - Provide an under-stage server selection chip bar (`[ ● HD-1 ] [ HD-2 ] [ Zoko ] [ Gogo ]`) on desktop and an in-menu server section in settings for mobile/fullscreen/theater modes.
   - Filter servers dynamically when switching between Sub and Dub audio.
3. **Zero-Reload Stream Hot-Swapping**:
   - Switching servers fetches the new stream via API and dynamically re-points Hls.js without a full page reload, preserving playback timestamp, volume, speed, and subtitle styling.
4. **Self-Healing Auto-Failover**:
   - Detect fatal HLS network errors (403, 404, or manifest stalls) and automatically fail over to the next healthy server in the priority chain with informative Action OSD feedback.

---

## 2. Architecture & Provider Specifications

```
                           +----------------------------------------+
                           |       Player Request / UI Action       |
                           |  (Watch Player / Cinema Miniplayer)    |
                           +-------------------+--------------------+
                                               |
                                     (API Request or Failover)
                                               v
                           +----------------------------------------+
                           |  resolveEpisodePlayback(origin, epId)  |
                           |      (src/services/episodeSources)     |
                           +-------------------+--------------------+
                                               |
                     +-------------------------+-------------------------+
                     |                         |                         |
                     v                         v                         v
           +-------------------+     +-------------------+     +-------------------+
           |     MegaPlay      |     |       Zoko        |     |     GogoAnime     |
           |   (HD-1 & HD-2)   |     |    (Otaku XOR)    |     |  (VidCDN / Ajax)  |
           +-------------------+     +-------------------+     +-------------------+
           | AES-256-CBC Dec.  |     | Base64 + XOR Dec. |     | HTML / Ajax Dec.  |
           | MegaCloud / Rapid |     | ZokoAnime video   |     | Embtaku / VidCDN  |
           +---------+---------+     +---------+---------+     +---------+---------+
                     |                         |                         |
                     +-------------------------+-------------------------+
                                               |
                                               v
                           +----------------------------------------+
                           |         ProviderStreamResult           |
                           |   (HLS URL, Subtitles, Skip Timings)   |
                           +-------------------+--------------------+
                                               |
                                               v
                           +----------------------------------------+
                           |    Client Hls.js Hot-Swap Manager      |
                           | (Preserves Time, Volume, Subtitles)    |
                           +----------------------------------------+
```

### 2.1 Provider Implementations
1. **`megaplay` (HD-1 & HD-2)**:
   - Parses HiAnime theme servers from `episode/servers?episodeId=...`.
   - Distinct server routing:
     - `hd-1`: Targets MegaCloud / VidStreaming embed hash.
     - `hd-2`: Targets RapidCloud / VidCloud embed hash.
   - Decrypts embed payload via AES-256-CBC using `MEGAPLAY_KEY` and `MEGAPLAY_IV`.
   - Capabilities: Adaptive HLS, multi-language soft subtitles, intro/outro skip timestamps.
2. **`zoko`**:
   - Parses ZokoAnime embed if present or resolves via Otaku embed URL.
   - Deobfuscates `window.__P` blob using XOR (`otaku-embed-v1`) + base64 decoding.
   - Capabilities: Clean adaptive HLS, default English subtitles.
3. **`gogoanime` (New Backup Provider)**:
   - Self-contained scraper service in `src/services/gogoanime.ts`.
   - Resolves episode stream via GogoAnime public mirrors:
     - Search anime by title / slug to find Gogo episode page.
     - Extract streaming iframe (`embtaku.pro/streaming.php?id=...`).
     - Decrypt sources via Ajax HLS resolver.
   - Capabilities: Independent CDN infrastructure, resilient fallback when HiAnime is blocked.

### 2.2 Standardized Stream Interface
```typescript
export interface ProviderStreamResult {
  provider: 'megaplay' | 'zoko' | 'gogoanime';
  server: 'hd-1' | 'hd-2' | 'zoko' | 'gogo';
  serverLabel: string;
  category: 'sub' | 'dub';
  m3u8: string;
  sources: Array<{ url: string; isM3U8: boolean; quality?: string }>;
  subtitles: Array<{ lang: string; url: string; default?: boolean }>;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  headers?: Record<string, string>;
}
```

### 2.3 Scrape Cache Strategy
- Stream cache key: `stream:${episodeId}:${category}:${server}` with a 3-minute TTL (`180_000` ms).
- Server list cache key: `servers:${episodeId}` with a 5-minute TTL (`300_000` ms).

---

## 3. API Contracts

### 3.1 Server List: `GET /api/v2/hianime/episode/servers`
Enriched multi-provider server matrix:
```json
{
  "episodeId": "one-piece-1?ep=1",
  "episodeNo": 1,
  "sub": [
    { "serverId": "hd-1", "serverName": "hd-1", "label": "HD-1 (MegaCloud)", "provider": "megaplay", "preferred": true },
    { "serverId": "hd-2", "serverName": "hd-2", "label": "HD-2 (RapidCloud)", "provider": "megaplay", "preferred": false },
    { "serverId": "zoko", "serverName": "zoko", "label": "Zoko", "provider": "zoko", "preferred": false },
    { "serverId": "gogo", "serverName": "gogo", "label": "Gogo (Backup)", "provider": "gogoanime", "preferred": false }
  ],
  "dub": [
    { "serverId": "hd-1", "serverName": "hd-1", "label": "HD-1 (MegaCloud)", "provider": "megaplay", "preferred": true },
    { "serverId": "hd-2", "serverName": "hd-2", "label": "HD-2 (RapidCloud)", "provider": "megaplay", "preferred": false }
  ],
  "raw": []
}
```

### 3.2 Stream Sources: `GET /api/v2/hianime/episode/sources`
Parameters:
- `animeEpisodeId`: string (required)
- `server`: `hd-1` | `hd-2` | `zoko` | `gogo` (default: `hd-1`)
- `category`: `sub` | `dub` (default: `sub`)

Response contains the resolved stream URL, subtitles, intro/outro timestamps, and full server list for client-side auto-failover.

### 3.3 Watch Play Entry: `GET /api/v2/hianime/watch/play`
Preserves `&server=...` across 302 redirects to `/watch` so direct links retain server choices.

---

## 4. Frontend Watch Player UX (`src/handlers/pages/watch.ts`)

### 4.1 Server Selection Bar (`.server-bar`)
- Rendered below `.stage-wrap` on desktop:
  ```html
  <div class="server-bar" id="serverBar">
    <span class="server-bar-label">Server</span>
    <div class="server-chips" id="serverChips">
      <!-- Dynamic server pills -->
    </div>
  </div>
  ```
- Also rendered inside `#settingsMenu` (`#serverSection`) for fullscreen and mobile access.
- Filtered dynamically based on active audio track (`sub` vs `dub`).

### 4.2 Client-Side Stream Hot-Swapping
```javascript
async function switchServer(newServer, isAutoFailover) {
  if (switchingServer || newServer === currentServer) return;
  switchingServer = true;
  var savedTime = video.currentTime;
  var wasPlaying = !video.paused;

  showOsd('⚡', 'Switching to ' + serverLabel(newServer) + '…');
  updateServerChipsLoading(newServer);

  try {
    var data = await fetchEpisodeSources(episodeId, newServer, currentTrack);
    currentServer = newServer;
    localStorage.setItem('ani.preferredServer', newServer);
    
    hls.loadSource(data.m3u8);
    hls.attachMedia(video);
    
    video.addEventListener('loadedmetadata', function onMeta() {
      video.removeEventListener('loadedmetadata', onMeta);
      video.currentTime = savedTime;
      if (wasPlaying) video.play().catch(function () {});
      showOsd('✓', 'Switched to ' + serverLabel(newServer));
      updateServerChipsActive(newServer);
    });
  } catch (err) {
    if (!isAutoFailover) handleFailover();
  } finally {
    switchingServer = false;
  }
}
```

### 4.3 Self-Healing Auto-Failover Matrix

| Event | Action | Notification |
| :--- | :--- | :--- |
| `Hls.ErrorTypes.NETWORK_ERROR` (Fatal) | Call `hls.startLoad()`; if unresolved within 3s, step to next server | `⚠️ Stream interrupted · Auto-switching to HD-2...` |
| 403 CDN Token Expiry | Immediately step to next server in priority order | `⚠️ CDN expired · Auto-switching to Zoko...` |
| All Servers Exhausted | Display in-player interactive Recovery Overlay | `Playback failed on all available servers. [⟳ Retry] [⇄ Switch Audio] [✕ Close]` |

---

## 5. Browse Page Cinema Player Integration (`src/handlers/pages/browse.ts`)
- `playEpisode` reads `localStorage.getItem('ani.preferredServer') || 'hd-1'`.
- If preferred server fails during initial source lookup, attempts pre-flight fallback (`hd-2` $\rightarrow$ `zoko` $\rightarrow$ `gogo`).
- Passes `&server=${preferred}` into the iframe URL so the player launches with the user's preferred server.

---

## 6. Testing & Verification Plan

### 6.1 Unit & Integration Tests
- `tests/services/gogoanime.test.ts`: Verify GogoAnime title search, iframe extraction, and stream decryption.
- `tests/services/episodeSourcesMulti.test.ts`: Verify distinct routing for `hd-1`, `hd-2`, `zoko`, and `gogo`, cache partitioning, and fallback chains.
- `tests/handlers/serversMulti.test.ts`: Verify `/api/v2/hianime/episode/servers` output schema with multi-provider metadata.
- `tests/handlers/watchServerSwitcher.test.ts`: Verify watch page renders server chips, settings server section, and client-side hot-swapping script.

### 6.2 Regressions & Build
- `npm test`: Verify 100% of existing and new Vitest tests pass.
- `npm run type-check`: Confirm 0 TypeScript compilation errors.
- `npm run test:mobile`: Verify all 33 Playwright mobile tests pass.
- `node build-vercel.mjs`: Verify production Vercel bundle compiles cleanly.

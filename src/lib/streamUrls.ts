import { Context } from 'hono';

/** Public site origin (honours proxy headers; forces https on non-local hosts). */
export function requestOrigin(c: Context): string {
  const url = new URL(c.req.url);
  const xfProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const xfHost = (c.req.header('x-forwarded-host') || c.req.header('host') || url.host)
    .split(',')[0]
    ?.trim();
  const host = xfHost || url.host;
  let proto = xfProto || url.protocol.replace(':', '') || 'https';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  if (!local && proto === 'http') proto = 'https';
  return `${proto}://${host}`;
}

/**
 * SSRF guard: block private/reserved hostnames and IP ranges.
 * We use a blocklist (not an allowlist) so CDN rotations never break playback.
 * The proxy only accepts https:// URLs, so the risk surface is already narrow.
 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,   // link-local / AWS metadata
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
  /\.local$/i,
  /\.internal$/i,
];

/**
 * Returns true when the hostname is safe to proxy — i.e. it is NOT a
 * private/loopback/link-local address. CDN hostnames are not checked;
 * the upstream provider (MegaPlay/Zoko) is responsible for what it returns.
 */
export function isAllowedStreamHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return !BLOCKED_HOST_PATTERNS.some((re) => re.test(host));
}

/** Upstream Referer the CDN expects when we proxy a playlist/segment. */
export function refererForStreamUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('aniwatchtv') || host.includes('zoko')) {
      return 'https://zokoanime.video/';
    }
  } catch {
    // fall through
  }
  return 'https://megaplay.buzz/';
}

/**
 * Optional Cloudflare Worker (or other) origin for media bytes.
 * When set, HLS/poster URLs leave Vercel so Fast Origin Transfer stays low.
 * Example: https://hianime-media-proxy.myaccount.workers.dev
 */
export function mediaProxyOrigin(): string | null {
  const raw = (process.env.MEDIA_PROXY_ORIGIN || '').trim().replace(/\/+$/, '');
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

/** Shared secret for /hls and /poster (`k` query param). Empty = open (dev only). */
export function mediaProxySecret(): string | null {
  const raw = (process.env.MEDIA_PROXY_SECRET || '').trim();
  return raw || null;
}

/** Append `k=` when MEDIA_PROXY_SECRET is configured. */
export function withMediaProxyAuth(proxyUrl: string): string {
  const k = mediaProxySecret();
  if (!k) return proxyUrl;
  try {
    const u = new URL(proxyUrl);
    u.searchParams.set('k', k);
    return u.href;
  } catch {
    const join = proxyUrl.includes('?') ? '&' : '?';
    return `${proxyUrl}${join}k=${encodeURIComponent(k)}`;
  }
}

/** True when request carries a valid media proxy key (or secret is unset). */
export function mediaProxyAuthOk(provided: string | null | undefined): boolean {
  const expected = mediaProxySecret();
  if (!expected) return true;
  if (!provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

/** Base URL for HLS proxy (Worker `/hls` or same-origin API path). */
export function hlsProxyBase(siteOrigin: string): string {
  const media = mediaProxyOrigin();
  if (media) return `${media}/hls`;
  return `${siteOrigin.replace(/\/+$/, '')}/api/v2/hianime/hls`;
}

/** Base URL for poster proxy (Worker `/poster` or same-origin API path). */
export function posterProxyBase(siteOrigin: string): string {
  const media = mediaProxyOrigin();
  if (media) return `${media}/poster`;
  return `${siteOrigin.replace(/\/+$/, '')}/api/v2/hianime/poster`;
}

/** Base URL for subtitle/VTT proxy (Worker `/vtt` or same-origin API path). */
export function vttProxyBase(siteOrigin: string): string {
  const media = mediaProxyOrigin();
  if (media) return `${media}/vtt`;
  return `${siteOrigin.replace(/\/+$/, '')}/api/v2/hianime/vtt`;
}

/** Build an authenticated proxy URL for an upstream media/poster URL. */
export function buildMediaProxyUrl(proxyBase: string, upstreamUrl: string): string {
  return withMediaProxyAuth(`${proxyBase}?url=${encodeURIComponent(upstreamUrl)}`);
}

export function proxiedHlsUrl(origin: string, m3u8: string): string {
  return buildMediaProxyUrl(hlsProxyBase(origin), m3u8);
}

/** Proxy a subtitle/VTT URL through the open-CDN VTT proxy (adds CORS + forced text/vtt). */
export function proxiedVttUrl(origin: string, vttUrl: string): string {
  // VTT proxy does not require auth — no k= appended (unlike HLS/poster proxies).
  return `${vttProxyBase(origin)}?url=${encodeURIComponent(vttUrl)}`;
}

/** Prefer English softsub VTT from provider track lists (HTML5 <track> needs VTT). */
export function pickEnglishSubtitle(
  subs: Array<{ lang?: string; url?: string }> | undefined | null
): string | null {
  if (!subs?.length) return null;
  const scored = subs
    .filter((s) => s.url && /^https?:\/\//i.test(s.url))
    .map((s) => {
      const lang = (s.lang || '').trim();
      let score = 0;
      if (/^(en|eng|english)([-_]|$)/i.test(lang) || /\benglish\b/i.test(lang)) score += 10;
      // Prefer explicit VTT URLs, but don't exclude non-.vtt CDN paths
      if (/\.vtt(\?|$)/i.test(s.url as string)) score += 2;
      return { url: s.url as string, score };
    })
    .filter((s) => s.score >= 10)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.url || null;
}

type SkipRange = { start: number; end: number } | null | undefined;

function setSkipParams(
  params: URLSearchParams,
  prefix: string,
  range: SkipRange
): void {
  if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end)) return;
  if (range.end <= range.start) return;
  params.set(`${prefix}s`, String(Math.round(range.start)));
  params.set(`${prefix}e`, String(Math.round(range.end)));
}

/** Browser player URL. Pass CDN m3u8(s); optional English CC + short episode-nav ids. */
export function watchPageUrl(
  origin: string,
  opts: {
    sub?: string | null;
    dub?: string | null;
    subCc?: string | null;
    dubCc?: string | null;
    category?: string;
    animeId?: string | null;
    animeTitle?: string | null;
    episodeId?: string | null;
    episodeNumber?: number | null;
    episodeTitle?: string | null;
    /** Neighbor episode ids only (keep watch URLs short). */
    prevEpisodeId?: string | null;
    nextEpisodeId?: string | null;
    epIndex?: number | null;
    epTotal?: number | null;
    /** Sub (or shared) intro/outro seconds from MegaPlay. */
    intro?: SkipRange;
    outro?: SkipRange;
    /** Dub-specific intro/outro when both tracks exist. */
    dubIntro?: SkipRange;
    dubOutro?: SkipRange;
    /** Active / per-track provider ids (megaplay | zoko). */
    provider?: string | null;
    subProvider?: string | null;
    dubProvider?: string | null;
  }
): string {
  const base = origin.replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (opts.sub) params.set('sub', opts.sub);
  if (opts.dub) params.set('dub', opts.dub);
  if (opts.subCc) params.set('subCc', opts.subCc);
  if (opts.dubCc) params.set('dubCc', opts.dubCc);
  if (opts.animeId) params.set('anime', opts.animeId);
  if (opts.animeTitle) params.set('title', opts.animeTitle);
  if (opts.episodeId) params.set('ep', opts.episodeId);
  if (opts.episodeNumber != null) params.set('n', String(opts.episodeNumber));
  if (opts.episodeTitle) params.set('epTitle', opts.episodeTitle);
  if (opts.prevEpisodeId) params.set('prevEp', opts.prevEpisodeId);
  if (opts.nextEpisodeId) params.set('nextEp', opts.nextEpisodeId);
  if (opts.epIndex != null) params.set('i', String(opts.epIndex));
  if (opts.epTotal != null) params.set('total', String(opts.epTotal));
  setSkipParams(params, 'i', opts.intro);
  setSkipParams(params, 'o', opts.outro);
  setSkipParams(params, 'di', opts.dubIntro);
  setSkipParams(params, 'do', opts.dubOutro);
  if (opts.subProvider) params.set('sp', opts.subProvider);
  if (opts.dubProvider) params.set('dp', opts.dubProvider);
  const preferred =
    opts.category === 'dub' && opts.dub
      ? 'dub'
      : opts.category === 'sub' && opts.sub
        ? 'sub'
        : opts.sub
          ? 'sub'
          : opts.dub
            ? 'dub'
            : 'sub';
  params.set('t', preferred);
  const activeProvider =
    opts.provider ||
    (preferred === 'dub' ? opts.dubProvider : opts.subProvider) ||
    opts.subProvider ||
    opts.dubProvider;
  if (activeProvider) params.set('p', activeProvider);
  const primary = preferred === 'dub' ? opts.dub : opts.sub || opts.dub;
  if (primary) params.set('url', primary);
  return `${base}/api/v2/hianime/watch?${params.toString()}`;
}

/** Public hop URL used by Prev/Next on the watch page. */
export function watchPlayUrl(
  origin: string,
  episodeId: string,
  category: string = 'sub'
): string {
  const base = origin.replace(/\/+$/, '');
  const params = new URLSearchParams({
    animeEpisodeId: episodeId.includes('::') ? episodeId.replace('::', '?') : episodeId,
    category: category === 'dub' ? 'dub' : 'sub',
  });
  return `${base}/api/v2/hianime/watch/play?${params.toString()}`;
}

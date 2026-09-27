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

const ALLOWED_HOST_SUFFIXES = [
  'megaplay.buzz',
  'shiora.top',
  'akirax.buzz',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'hiddenvertex.top',
  'aniwatchtv.uk',
  'zokoanime.video',
];

/** CDN hosts used by MegaPlay / Zoko playlists and segments. */
export function isAllowedStreamHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host.startsWith('megap.')) return true;
  if (host.startsWith('hls') && host.includes('aniwatchtv')) return true;
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
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

export function proxiedHlsUrl(origin: string, m3u8: string): string {
  return `${origin.replace(/\/+$/, '')}/api/v2/hianime/hls?url=${encodeURIComponent(m3u8)}`;
}

/** Prefer English softsub VTT from provider track lists (HTML5 <track> needs VTT). */
export function pickEnglishSubtitle(
  subs: Array<{ lang?: string; url?: string }> | undefined | null
): string | null {
  if (!subs?.length) return null;
  const scored = subs
    .filter((s) => s.url && /^https?:\/\//i.test(s.url) && /\.vtt(\?|$)/i.test(s.url))
    .map((s) => {
      const lang = (s.lang || '').trim();
      let score = 0;
      if (/^(en|eng|english)([-_]|$)/i.test(lang) || /\benglish\b/i.test(lang)) score += 10;
      return { url: s.url as string, score };
    })
    .filter((s) => s.score >= 10)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.url || null;
}

/** Browser player URL. Pass CDN m3u8(s); optional English CC + episode nav meta. */
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
    prevPlay?: string | null;
    nextPlay?: string | null;
    epIndex?: number | null;
    epTotal?: number | null;
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
  if (opts.prevPlay) params.set('prev', opts.prevPlay);
  if (opts.nextPlay) params.set('next', opts.nextPlay);
  if (opts.epIndex != null) params.set('i', String(opts.epIndex));
  if (opts.epTotal != null) params.set('total', String(opts.epTotal));
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
  const primary = preferred === 'dub' ? opts.dub : opts.sub || opts.dub;
  if (primary) params.set('url', primary);
  return `${base}/api/v2/hianime/watch?${params.toString()}`;
}

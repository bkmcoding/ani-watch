import { load } from 'cheerio';
import config from '../config/config';

export interface GogoStreamResult {
  headers: Record<string, string>;
  sources: Array<{ url: string; isM3U8: boolean; quality?: string }>;
  subtitles: Array<{ lang: string; url: string; default?: boolean }>;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  anilistID: null;
  malID: null;
}

const DEFAULT_UA =
  config.headers?.['User-Agent'] ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

export const GOGO_BASE_URL = (process.env.GOGO_BASE_URL || 'https://anitaku.to').replace(/\/+$/, '');

/**
 * Normalizes an anime title into a standard GogoAnime URL slug.
 * Removes apostrophes, maps non-alphanumeric chars to hyphens, and trims edges.
 */
export function formatGogoSlug(title: string): string {
  if (!title || typeof title !== 'string') return '';
  const trimmed = title.trim();
  if (!trimmed) return '';

  return trimmed
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formats standard episode URL path for GogoAnime.
 */
export function formatGogoEpisodeUrl(slug: string, epNum: number | string): string {
  const cleanSlug = (slug || '').replace(/^\/+|\/+$/g, '');
  return `/${cleanSlug}-episode-${epNum}`;
}

/**
 * Parses episode HTML to find streaming iframe URL.
 */
export function extractGogoStreamingIframe(html: string): string | null {
  if (!html || typeof html !== 'string') return null;

  try {
    const $ = load(html);
    let src =
      $('.play-video iframe').attr('src') ||
      $('iframe[src*="streaming.php"]').attr('src') ||
      $('iframe[src*="embtaku"]').attr('src') ||
      $('iframe[src*="vidstreaming"]').attr('src') ||
      $('iframe[src*="gogocdn"]').attr('src') ||
      $('.anime_muti_link iframe').attr('src') ||
      $('.anime_video_body iframe').attr('src') ||
      $('iframe').attr('src');

    if (!src) {
      const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      src = match ? match[1] : undefined;
    }

    if (!src) return null;
    src = src.trim();
    if (src.startsWith('//')) {
      src = `https:${src}`;
    }
    return src;
  } catch (err: unknown) {
    console.warn('[GogoAnime] Failed to parse streaming iframe:', err);
    return null;
  }
}

/**
 * Resolves direct m3u8 stream and subtitle tracks from embed player URL.
 */
export async function extractGogoSourcesFromEmbed(
  embedUrl: string
): Promise<GogoStreamResult | null> {
  if (!embedUrl || typeof embedUrl !== 'string') return null;

  try {
    let embedOrigin = GOGO_BASE_URL;
    try {
      embedOrigin = new URL(embedUrl).origin;
    } catch {
      // ignore
    }

    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Referer: `${GOGO_BASE_URL}/`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.warn(`[GogoAnime] Embed request failed with HTTP ${res.status} for ${embedUrl}`);
      return null;
    }

    const html = await res.text();
    const $ = load(html);

    const sources: Array<{ url: string; isM3U8: boolean; quality?: string }> = [];
    const subtitles: Array<{ lang: string; url: string; default?: boolean }> = [];

    // 1. Cheerio DOM inspection (<source> and <video> tags)
    $('source[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && /\.m3u8(\?|$)/i.test(src)) {
        const quality = $(el).attr('label') || $(el).attr('title') || 'auto';
        if (!sources.some(s => s.url === src)) {
          sources.push({ url: src, isM3U8: true, quality });
        }
      }
    });

    $('video[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && /\.m3u8(\?|$)/i.test(src)) {
        if (!sources.some(s => s.url === src)) {
          sources.push({ url: src, isM3U8: true, quality: 'auto' });
        }
      }
    });

    $('track[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const lang = $(el).attr('label') || $(el).attr('srclang') || 'Unknown';
        const isDef = $(el).is('[default]') || $(el).attr('default') === 'true';
        if (!subtitles.some(s => s.url === src)) {
          subtitles.push({ lang, url: src, default: isDef });
        }
      }
    });

    // 2. Script inspection for jwplayer setup / inline sources
    const sourcesBlockMatch = html.match(/sources\s*:\s*(\[[^\]]+\])/i);
    if (sourcesBlockMatch) {
      const block = sourcesBlockMatch[1];
      const fileMatches = [...block.matchAll(/(?:file|src)\s*:\s*["']([^"']+)["']/gi)];
      for (const match of fileMatches) {
        const url = match[1];
        if (/\.m3u8(\?|$)/i.test(url) && !sources.some(s => s.url === url)) {
          sources.push({ url, isM3U8: true, quality: 'auto' });
        }
      }
    }

    // 3. Script inspection for tracks / subtitles
    const tracksBlockMatch = html.match(/tracks\s*:\s*(\[[^\]]+\])/i);
    if (tracksBlockMatch) {
      const block = tracksBlockMatch[1];
      const trackItems = [...block.matchAll(/\{([^{}]+)\}/g)];
      for (const item of trackItems) {
        const content = item[1];
        const fileMatch = content.match(/file\s*:\s*["']([^"']+)["']/i);
        const labelMatch = content.match(/label\s*:\s*["']([^"']+)["']/i);
        const defaultMatch = content.match(/default\s*:\s*(true|false)/i);
        if (fileMatch && !subtitles.some(s => s.url === fileMatch[1])) {
          subtitles.push({
            lang: labelMatch ? labelMatch[1] : 'Unknown',
            url: fileMatch[1],
            default: defaultMatch ? defaultMatch[1] === 'true' : false,
          });
        }
      }
    }

    // 4. Any direct m3u8 URLs present in HTML
    if (sources.length === 0) {
      const m3u8Matches = [...html.matchAll(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/gi)];
      for (const m of m3u8Matches) {
        const url = m[0];
        if (!sources.some(s => s.url === url)) {
          sources.push({ url, isM3U8: true, quality: 'auto' });
        }
      }
    }

    // 5. Vidstreaming AJAX endpoint fallback (if no direct sources found)
    if (sources.length === 0) {
      let id: string | null = null;
      try {
        id = new URL(embedUrl).searchParams.get('id');
      } catch {
        // ignore
      }

      if (!id) {
        const idMatch =
          html.match(/data-id=["']([^"']+)["']/i) ||
          html.match(/episode_id\s*=\s*["']([^"']+)["']/i) ||
          html.match(/id\s*=\s*["']([^"']+)["']/i);
        id = idMatch ? idMatch[1] : null;
      }

      if (id) {
        const ajaxUrls = [
          `${embedOrigin}/ajax/getSources?id=${encodeURIComponent(id)}`,
          `${embedOrigin}/encrypt-ajax.php?id=${encodeURIComponent(id)}`,
        ];

        for (const ajaxUrl of ajaxUrls) {
          try {
            const ajaxRes = await fetch(ajaxUrl, {
              headers: {
                'User-Agent': DEFAULT_UA,
                Referer: embedUrl,
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json, text/javascript, */*; q=0.01',
              },
              signal: AbortSignal.timeout(12000),
            });

            if (!ajaxRes.ok) continue;

            const ajaxText = await ajaxRes.text();
            let payload: Record<string, unknown> | null = null;
            try {
              payload = JSON.parse(ajaxText);
            } catch {
              continue;
            }

            if (!payload) continue;

            interface RawSource {
              file?: string;
              url?: string;
              label?: string;
              type?: string;
            }

            const rawSources = (payload.source || payload.sources || []) as RawSource[];
            if (Array.isArray(rawSources)) {
              for (const s of rawSources) {
                const streamUrl = s.file || s.url;
                if (streamUrl && (/\.m3u8(\?|$)/i.test(streamUrl) || s.type === 'hls')) {
                  if (!sources.some(item => item.url === streamUrl)) {
                    sources.push({
                      url: streamUrl,
                      isM3U8: true,
                      quality: s.label || 'auto',
                    });
                  }
                }
              }
            }

            interface RawTrack {
              file?: string;
              label?: string;
              lang?: string;
              default?: boolean;
            }

            const trackObj = payload.track as { tracks?: RawTrack[] } | undefined;
            const rawTracks = (trackObj?.tracks || payload.tracks || []) as RawTrack[];
            if (Array.isArray(rawTracks)) {
              for (const t of rawTracks) {
                if (t.file && !subtitles.some(sub => sub.url === t.file)) {
                  subtitles.push({
                    lang: t.label || t.lang || 'Unknown',
                    url: t.file,
                    default: Boolean(t.default),
                  });
                }
              }
            }

            if (sources.length > 0) break;
          } catch {
            // continue next ajax URL
          }
        }
      }
    }

    if (sources.length === 0) {
      console.warn(`[GogoAnime] No playable sources found for embed: ${embedUrl}`);
      return null;
    }

    return {
      headers: {
        Referer: embedUrl,
        'User-Agent': DEFAULT_UA,
      },
      sources,
      subtitles,
      intro: null,
      outro: null,
      anilistID: null,
      malID: null,
    };
  } catch (err: unknown) {
    console.warn(`[GogoAnime] Error extracting sources from embed ${embedUrl}:`, err);
    return null;
  }
}

/**
 * Orchestrates full fallback resolution:
 * anime title -> slug -> episode page -> embed iframe -> direct stream result.
 * Always resolves gracefully to null on failure without throwing.
 */
export async function resolveGogoSources(
  animeTitle: string,
  epNum: number | string
): Promise<GogoStreamResult | null> {
  try {
    if (!animeTitle || typeof animeTitle !== 'string' || !animeTitle.trim()) {
      return null;
    }

    const slug = formatGogoSlug(animeTitle);
    if (!slug) return null;

    const episodePath = formatGogoEpisodeUrl(slug, epNum);
    const episodeUrl = `${GOGO_BASE_URL}${episodePath}`;

    const res = await fetch(episodeUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Referer: `${GOGO_BASE_URL}/`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.warn(`[GogoAnime] Failed to fetch episode page ${episodeUrl}: HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const iframeUrl = extractGogoStreamingIframe(html);
    if (!iframeUrl) {
      console.warn(`[GogoAnime] No streaming iframe found on ${episodeUrl}`);
      return null;
    }

    const streamResult = await extractGogoSourcesFromEmbed(iframeUrl);
    return streamResult;
  } catch (err: unknown) {
    console.warn(`[GogoAnime] Stream resolution failed for "${animeTitle}" ep ${epNum}:`, err);
    return null;
  }
}

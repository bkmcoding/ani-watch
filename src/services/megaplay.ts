import { createDecipheriv } from 'node:crypto';
import { load } from 'cheerio';
import config from '../config/config';

/** MegaPlay AES-256-CBC key/IV from newclient.min.js */
const MEGAPLAY_KEY = Buffer.alloc(32);
Buffer.from('i?LMTAx0Q6,:}50U', 'utf8').copy(MEGAPLAY_KEY);
const MEGAPLAY_IV = Buffer.alloc(16);
Buffer.from("W0;27ToaUpl_P%'c", 'utf8').copy(MEGAPLAY_IV);

const DEFAULT_UA =
  config.headers?.['User-Agent'] ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

function b64urlToBuf(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function decryptMegaPlayEnc(enc: string): string {
  const decipher = createDecipheriv('aes-256-cbc', MEGAPLAY_KEY, MEGAPLAY_IV);
  return Buffer.concat([decipher.update(b64urlToBuf(enc)), decipher.final()]).toString('utf8');
}

export interface ThemeServer {
  type: 'sub' | 'dub' | 'raw' | string;
  serverName: string;
  serverId: number;
  embedUrl: string;
}

export function parseThemeServers(html: string): ThemeServer[] {
  const $ = load(html);
  const servers: ThemeServer[] = [];
  let idx = 0;

  $('.server-item[data-hash]').each((_, el) => {
    const $el = $(el);
    const hash = $el.attr('data-hash');
    if (!hash) return;
    let embedUrl = '';
    try {
      embedUrl = Buffer.from(hash, 'base64').toString('utf8');
    } catch {
      return;
    }
    idx += 1;
    servers.push({
      type: ($el.attr('data-type') || 'sub').toLowerCase(),
      serverName: ($el.attr('data-server-name') || $el.text().trim() || `server-${idx}`).trim(),
      serverId: idx,
      embedUrl,
    });
  });

  return servers;
}

export function pickServer(
  servers: ThemeServer[],
  serverName: string,
  category: string
): ThemeServer | null {
  const cat = category.toLowerCase();
  const want = serverName.toLowerCase().replace(/\s+/g, '-');
  const pool = servers.filter((s) => s.type === cat);

  const exact =
    pool.find((s) => s.serverName.toLowerCase().replace(/\s+/g, '-') === want) ||
    pool.find((s) => s.serverName.toLowerCase().includes(want.replace(/-/g, ' '))) ||
    pool.find((s) => s.serverName.toLowerCase().includes(want));

  if (exact) return exact;

  // Prefer MegaPlay HD embeds for playback
  return (
    pool.find((s) => /megaplay/i.test(s.embedUrl) && /hd-?1/i.test(s.serverName)) ||
    pool.find((s) => /megaplay/i.test(s.embedUrl)) ||
    pool[0] ||
    null
  );
}

interface MegaPlayTrack {
  file?: string;
  label?: string;
  kind?: string;
  default?: boolean;
}

interface MegaPlaySourcesPayload {
  tracks?: MegaPlayTrack[];
  intro?: { start?: number; end?: number };
  outro?: { start?: number; end?: number };
  server?: number;
  enc?: string;
  sources?: string | { file?: string };
  encrypted?: boolean;
}

export interface StreamResult {
  headers: Record<string, string>;
  sources: Array<{ url: string; isM3U8: boolean; quality?: string }>;
  subtitles: Array<{ lang: string; url: string; default?: boolean }>;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  anilistID: null;
  malID: null;
}

async function fetchText(url: string, headers: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractMegaPlayIds(embedHtml: string): { id: string; realId?: string } | null {
  const $ = load(embedHtml);
  const player = $('#megaplay-player, [data-id][data-realid]').first();
  const id = player.attr('data-id');
  if (id) {
    return { id, realId: player.attr('data-realid') || undefined };
  }
  const m = embedHtml.match(/data-id=["'](\d+)["']/);
  return m ? { id: m[1] } : null;
}

function resolveM3u8FromDecrypted(decrypted: string): string | null {
  const trimmed = decrypted.trim();
  if (/^https?:\/\//i.test(trimmed) && /\.m3u8/i.test(trimmed)) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.file === 'string') return parsed.file;
    if (typeof parsed?.url === 'string') return parsed.url;
    if (Array.isArray(parsed) && typeof parsed[0]?.file === 'string') return parsed[0].file;
  } catch {
    // not JSON
  }
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/i);
  return urlMatch?.[0] || null;
}

export async function resolveMegaPlaySources(embedUrl: string): Promise<StreamResult> {
  const embedHtml = await fetchText(embedUrl, {
    'User-Agent': DEFAULT_UA,
    Referer: `${config.baseurl}/`,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  });

  const ids = extractMegaPlayIds(embedHtml);
  if (!ids?.id) {
    throw new Error('Could not find MegaPlay source id in embed');
  }

  const embed = new URL(embedUrl);
  const sParam = embed.searchParams.get('s');
  const getSourcesUrl = new URL(`${embed.origin}/stream/getSources`);
  getSourcesUrl.searchParams.set('id', ids.id);
  if (sParam) getSourcesUrl.searchParams.set('s', sParam);

  const raw = await fetchText(getSourcesUrl.toString(), {
    'User-Agent': DEFAULT_UA,
    Referer: embedUrl,
    'X-Requested-With': 'XMLHttpRequest',
    Accept: '*/*',
  });

  let payload: MegaPlaySourcesPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('MegaPlay getSources returned non-JSON');
  }

  const enc =
    (typeof payload.enc === 'string' && payload.enc) ||
    (typeof payload.sources === 'string' && payload.sources) ||
    (typeof payload.sources === 'object' && payload.sources?.file) ||
    '';

  if (!enc) throw new Error('MegaPlay getSources missing encrypted stream');

  const decrypted = decryptMegaPlayEnc(enc);
  const m3u8 = resolveM3u8FromDecrypted(decrypted);
  if (!m3u8) throw new Error('Failed to decrypt MegaPlay stream URL');

  const subtitles = (payload.tracks || [])
    .filter((t) => t.file && (t.kind === 'captions' || t.kind === 'subtitles' || !t.kind))
    .map((t) => ({
      lang: t.label || 'Unknown',
      url: t.file as string,
      default: Boolean(t.default),
    }));

  const intro =
    payload.intro?.start != null && payload.intro?.end != null
      ? { start: payload.intro.start, end: payload.intro.end }
      : null;
  const outro =
    payload.outro?.start != null && payload.outro?.end != null
      ? { start: payload.outro.start, end: payload.outro.end }
      : null;

  return {
    headers: {
      Referer: embed.origin + '/',
      'User-Agent': DEFAULT_UA,
    },
    sources: [
      {
        url: m3u8,
        isM3U8: true,
        quality: 'auto',
      },
    ],
    subtitles,
    intro,
    outro,
    anilistID: null,
    malID: null,
  };
}

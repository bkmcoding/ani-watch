import config from '../config/config';

const OBF_KEY = 'otaku-embed-v1';
const DEFAULT_UA =
  config.headers?.['User-Agent'] ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

function xor(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length));
  }
  return out;
}

/** Decode ZokoAnime `window.__P` blob (otaku-embed-v1 XOR + base64). */
export function deobfuscateZoko(blob: string): Record<string, unknown> {
  // atob + escape/unescape mirrors their obfuscate.js
  const decoded = xor(Buffer.from(blob, 'base64').toString('binary'));
  // binary string → UTF-8 via percent-encoding (escape/unescape equivalent)
  const json = decodeURIComponent(
    Array.from(decoded, (ch) => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  );
  return JSON.parse(json);
}

export interface ZokoStreamResult {
  headers: Record<string, string>;
  sources: Array<{ url: string; isM3U8: boolean; quality?: string }>;
  subtitles: Array<{ lang: string; url: string; default?: boolean }>;
  intro: null;
  outro: null;
  anilistID: null;
  malID: null;
}

export async function resolveZokoSources(embedUrl: string): Promise<ZokoStreamResult> {
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Referer: `${config.baseurl}/`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Zoko embed HTTP ${res.status}`);
  const html = await res.text();
  const blob = html.match(/window\.__P\s*=\s*["']([^"']+)["']/)?.[1];
  if (!blob) throw new Error('Zoko embed missing __P payload');

  const data = deobfuscateZoko(blob) as {
    src?: string;
    subtitles?: Array<{ lang?: string; label?: string; src?: string; default?: boolean }>;
  };
  const m3u8 = data.src;
  if (!m3u8 || !/\.m3u8(\?|$)/i.test(m3u8)) {
    throw new Error('Zoko payload missing m3u8 src');
  }

  return {
    headers: {
      Referer: 'https://zokoanime.video/',
      'User-Agent': DEFAULT_UA,
    },
    sources: [{ url: m3u8, isM3U8: true, quality: 'auto' }],
    subtitles: (data.subtitles || [])
      .filter((t) => t.src)
      .map((t) => ({
        lang: t.label || t.lang || 'Unknown',
        url: t.src as string,
        default: Boolean(t.default),
      })),
    intro: null,
    outro: null,
    anilistID: null,
    malID: null,
  };
}

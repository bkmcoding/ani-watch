import { Context } from 'hono';
import { validationError } from '../utils/errors';
import {
  buildMediaProxyUrl,
  hlsProxyBase,
  isAllowedStreamHost,
  mediaProxyAuthOk,
  refererForStreamUrl,
  requestOrigin,
} from '../utils/streamUrls';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0';

function stripPngWrapper(buf: Buffer): Buffer {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const iend = buf.indexOf(Buffer.from('IEND'));
    if (iend > 0 && iend + 8 < buf.length) {
      const tail = buf.subarray(iend + 8);
      if (tail[0] === 0x47) return Buffer.from(tail);
    }
  }
  return buf;
}

function rewritePlaylist(body: string, playlistUrl: string, proxyBase: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          try {
            const abs = new URL(uri, playlistUrl).href;
            return `URI="${buildMediaProxyUrl(proxyBase, abs)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }
      try {
        const abs = new URL(trimmed, playlistUrl).href;
        return buildMediaProxyUrl(proxyBase, abs);
      } catch {
        return line;
      }
    })
    .join('\n');
}

const hlsProxyController = async (c: Context) => {
  if (!mediaProxyAuthOk(c.req.query('k') || undefined)) {
    throw new validationError('invalid or missing media proxy key');
  }

  const target = c.req.query('url');
  if (!target) throw new validationError('url is required');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new validationError('url must be absolute');
  }

  if (!/^https?:$/i.test(parsed.protocol) || !isAllowedStreamHost(parsed.hostname)) {
    throw new validationError('url host not allowed');
  }

  const referer = refererForStreamUrl(parsed.href);
  let originHeader = 'https://megaplay.buzz';
  try {
    originHeader = new URL(referer).origin;
  } catch {
    // keep default
  }

  const upstream = await fetch(parsed.href, {
    headers: {
      'User-Agent': UA,
      Referer: referer,
      Origin: originHeader,
      Accept: '*/*',
    },
    redirect: 'follow',
  });

  if (!upstream.ok) {
    return c.text(`Upstream ${upstream.status}`, 502);
  }

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist =
    ct.includes('mpegurl') ||
    ct.includes('m3u8') ||
    /\.m3u8(\?|$)/i.test(parsed.pathname);

  const proxyBase = hlsProxyBase(requestOrigin(c));

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, parsed.href, proxyBase);
    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const isVtt =
    ct.includes('text/vtt') ||
    ct.includes('vtt') ||
    /\.vtt(\?|$)/i.test(parsed.pathname);
  const isAss = /\.ass(\?|$)/i.test(parsed.pathname) || ct.includes('ass');

  if (isVtt || isAss) {
    const text = await upstream.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': isAss ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const media = stripPngWrapper(buf);
  return new Response(media, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export default hlsProxyController;

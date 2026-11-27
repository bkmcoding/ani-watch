/**
 * Runtime-agnostic core shared by the Vercel media handlers and the Cloudflare
 * Worker in `workers/media-proxy`.
 *
 * Keep this file dependency-free (no Hono, no Node built-ins): the Worker
 * imports it directly at bundle time. One copy means the SSRF guard, CDN
 * allowlist, redirect handling, byte caps and playlist rewriting cannot drift
 * between the two deployments.
 */

const MAX_STREAM_REDIRECTS = 5;
export const STREAM_FETCH_TIMEOUT_MS = 15_000;

/** Total budget for one HLS request, including the body download. */
export const HLS_UPSTREAM_TIMEOUT_MS = 30_000;

export const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_SUBTITLE_BYTES = 5 * 1024 * 1024; // 5 MiB
export const MAX_HLS_SEGMENT_BYTES = 32 * 1024 * 1024; // 32 MiB
export const MAX_POSTER_BYTES = 8 * 1024 * 1024; // 8 MiB

/**
 * CDN allowlist for the poster and subtitle (VTT/ASS) proxies. These are the
 * only hosts either proxy will fetch, including every redirect hop.
 */
const CDN_ALLOWED_DOMAINS = [
  'anipixcdn.co',
  'noitatnemucod.net',
  'bunnycdn.ru',
  'b-cdn.net',
  'wsrv.nl',
  'weserv.nl',
  'hianime.lu',
  'hianime.to',
  'aniwatchtv.to',
  // Subtitle CDNs used by MegaPlay / Zoko / GogoAnime tracks.
  'broforgotsave.online',
  'gogocdn.stream',
  'gogocdn.net',
  'vidcdn.pro',
  'megaplay.buzz',
  'zokoanime.video',
];

/** Raised when a target (initial or redirect hop) fails the URL guard. */
export class StreamUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamUrlError';
  }
}

/** Raised when an upstream body exceeds the proxy's byte budget. */
export class StreamResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`upstream response exceeds ${maxBytes} bytes`);
    this.name = 'StreamResponseTooLargeError';
  }
}

/** True when the dotted-quad IPv4 address is private, reserved, or non-routable. */
function isBlockedIpv4(a: number, b: number, c: number, d: number): boolean {
  if ([a, b, c, d].some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (a === 0) return true; // 0.0.0.0/8 (Current network / broadcast)
  if (a === 10) return true; // 10.0.0.0/8 (RFC 1918)
  if (a === 127) return true; // 127.0.0.0/8 (Loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local + cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT, incl. Alibaba metadata)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, TEST-NET-1
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // Multicast + reserved + broadcast
  return false;
}

/**
 * Expand an IPv6 literal into eight 16-bit hextets (a trailing dotted quad is
 * allowed). Returns null when the input is not a well-formed literal.
 *
 * Needed because `new URL()` normalises IPv4-mapped addresses to hex hextets:
 * `https://[::ffff:127.0.0.1]/` arrives as `::ffff:7f00:1`, which never matches
 * a dotted-quad regex.
 */
function parseIpv6Hextets(input: string): number[] | null {
  const host = input.trim().toLowerCase();
  // Zone indices are meaningless for remote hosts; reject rather than strip.
  if (host.includes('%')) return null;

  const parsePart = (part: string): number[] | null => {
    if (part === '') return [];
    const groups = part.split(':');
    const out: number[] = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (!group) return null;
      if (group.includes('.')) {
        // A dotted-quad tail must be the final group and contributes two hextets.
        if (i !== groups.length - 1) return null;
        const quads = group.split('.');
        if (quads.length !== 4 || !quads.every(q => /^\d{1,3}$/.test(q))) return null;
        const nums = quads.map(Number);
        if (nums.some(n => n > 255)) return null;
        out.push((nums[0] << 8) | nums[1], (nums[2] << 8) | nums[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      out.push(parseInt(group, 16));
    }
    return out;
  };

  const halves = host.split('::');
  if (halves.length > 2) return null;

  const head = parsePart(halves[0]);
  if (!head) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;

  const tail = parsePart(halves[1]);
  if (!tail) return null;
  const zeros = 8 - head.length - tail.length;
  // `::` must stand for at least one zero group.
  if (zeros < 1) return null;
  return [...head, ...new Array<number>(zeros).fill(0), ...tail];
}

/** True when the parsed IPv6 address is private, reserved, or maps a blocked IPv4. */
function isBlockedIpv6(hextets: number[]): boolean {
  const [h0, h1] = hextets;
  const zeroPrefix = (count: number) => hextets.slice(0, count).every(h => h === 0);
  const embeddedIpv4Blocked = (hi: number, lo: number) => {
    return isBlockedIpv4(hi >> 8, hi & 0xff, lo >> 8, lo & 0xff);
  };

  // :: (unspecified) and ::1 (loopback)
  if (hextets.every(h => h === 0)) return true;
  if (zeroPrefix(7) && hextets[7] === 1) return true;

  // ::ffff:0:0/96 (IPv4-mapped) and ::/96 (IPv4-compatible, deprecated).
  // These reach the embedded IPv4 verbatim, including hex forms such as
  // [::ffff:a9fe:a9fe] (169.254.169.254) and [::ffff:7f00:1] (127.0.0.1).
  if (zeroPrefix(5) && (hextets[5] === 0xffff || hextets[5] === 0)) {
    return embeddedIpv4Blocked(hextets[6], hextets[7]);
  }

  // 64:ff9b::/96 (NAT64) — reaches the embedded IPv4 after translation.
  if (h0 === 0x0064 && h1 === 0xff9b && hextets.slice(2, 6).every(h => h === 0)) {
    return embeddedIpv4Blocked(hextets[6], hextets[7]);
  }

  // 2002::/16 (6to4) — embedded IPv4 lives in hextets 1-2.
  if (h0 === 0x2002) return embeddedIpv4Blocked(hextets[1], hextets[2]);

  if ((h0 & 0xffc0) === 0xfe80) return true; // fe80::/10 (Link-local)
  if ((h0 & 0xffc0) === 0xfec0) return true; // fec0::/10 (deprecated site-local)
  if ((h0 & 0xfe00) === 0xfc00) return true; // fc00::/7 (Unique local)
  if ((h0 & 0xff00) === 0xff00) return true; // ff00::/8 (Multicast)

  return false;
}

/**
 * SSRF guard for stream hosts: rejects private/reserved literals, internal
 * TLDs and known rebinding wildcard domains.
 *
 * Hostnames are not resolved here, so a public name that resolves to a private
 * address is not caught; the allowlisted poster/subtitle proxies avoid that
 * exposure entirely.
 */
export function isAllowedStreamHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') return false;
  let host = hostname.trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  if (!host) return false;

  // Reject single integer or hex hostnames (e.g., 2130706433 or 0x7f000001)
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return false;

  // Single-label hostnames without a dot (e.g. "localhost", "redis", "intranet") are not public CDNs
  if (!host.includes('.') && !host.includes(':')) return false;

  // Reject internal/local TLDs, cloud metadata hostnames, and known DNS-rebinding wildcard domains
  if (
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    host.endsWith('.onion') ||
    host.endsWith('.nip.io') ||
    host.endsWith('.sslip.io') ||
    host.endsWith('.localtest.me') ||
    host.includes('metadata.google')
  ) {
    return false;
  }

  // IPv4 validation
  const ipv4Parts = host.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every(p => /^\d+$/.test(p))) {
    // Detect octal notation (leading zero on numbers > 0)
    if (ipv4Parts.some(p => p.length > 1 && p.startsWith('0'))) return false;

    const [a, b, c, d] = ipv4Parts.map(Number);
    return !isBlockedIpv4(a, b, c, d);
  }

  // IPv6 validation: parse the literal, then reject private/reserved forms —
  // including IPv4-mapped addresses written as hex hextets.
  if (host.includes(':')) {
    const hextets = parseIpv6Hextets(host);
    if (!hextets) return false;
    return !isBlockedIpv6(hextets);
  }

  return true;
}

/** True when the host is on the shared poster/subtitle CDN allowlist. */
export function isAllowedCdnHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') return false;
  const host = hostname.trim().toLowerCase();
  return CDN_ALLOWED_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
}

/** Upstream Referer the CDN expects when we proxy a playlist/segment. */
export function refererForStreamUrl(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  return host.includes('aniwatchtv') || host.includes('zoko')
    ? 'https://zokoanime.video/'
    : 'https://megaplay.buzz/';
}

function assertAllowedUrl(
  rawUrl: string,
  protocols: readonly string[],
  schemeMessage: string,
  hostAllowed: (hostname: string) => boolean
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new StreamUrlError('url must be absolute');
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new StreamUrlError(schemeMessage);
  }
  if (!hostAllowed(parsed.hostname)) {
    throw new StreamUrlError('url host not allowed');
  }
  return parsed;
}

/** Validate a stream URL: absolute, https, and not a private/reserved host. */
export function assertAllowedStreamUrl(rawUrl: string): URL {
  return assertAllowedUrl(
    rawUrl,
    ['https:'],
    'only https:// stream URLs are allowed',
    isAllowedStreamHost
  );
}

/** Validate a poster URL: absolute, http(s), and on the shared CDN allowlist. */
export function assertAllowedPosterUrl(rawUrl: string): URL {
  return assertAllowedUrl(
    rawUrl,
    ['https:', 'http:'],
    'only http(s) URLs are allowed',
    isAllowedCdnHost
  );
}

/** Validate a subtitle URL: absolute, https, and on the shared CDN allowlist. */
export function assertAllowedSubtitleUrl(rawUrl: string): URL {
  return assertAllowedUrl(
    rawUrl,
    ['https:'],
    'only https:// subtitle URLs are allowed',
    isAllowedCdnHost
  );
}

interface StreamFetchOptions {
  timeoutMs?: number;
  /**
   * Replaces the default stream guard for the initial URL and every redirect
   * hop. Used by the poster/subtitle proxies, whose allowlist is narrower than
   * the general stream blocklist.
   */
  validate?: (rawUrl: string) => URL;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // body already consumed/closed — nothing to release
  }
}

/**
 * Read a response body, aborting as soon as it exceeds `maxBytes`.
 *
 * A declared `Content-Length` over the budget rejects without reading. Chunked
 * responses are counted as they stream, so an unbounded upstream cannot buffer
 * the proxy out of memory.
 */
export async function readBodyCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = response.headers.get('content-length');
  if (declared) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes) {
      await discardBody(response);
      throw new StreamResponseTooLargeError(maxBytes);
    }
  }

  const body = response.body;
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new StreamResponseTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // stream already released
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Read a capped body as UTF-8 text (playlists, subtitles). */
export async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readBodyCapped(response, maxBytes));
}

/**
 * Fetch `url` while re-validating every redirect hop.
 * Throws {@link StreamUrlError} for a disallowed initial URL, redirect target,
 * redirect loop, or missing Location header.
 */
export async function fetchStreamWithRedirects(
  url: string,
  init: { headers?: Record<string, string> } = {},
  options: StreamFetchOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? STREAM_FETCH_TIMEOUT_MS;
  const validate = options.validate ?? assertAllowedStreamUrl;
  const signal = AbortSignal.timeout(timeoutMs);

  let current = validate(url).href;

  for (let hop = 0; ; hop++) {
    const response = await fetch(current, {
      headers: init.headers,
      redirect: 'manual',
      signal,
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return response;

    // Release the redirect body before following (or rejecting) the hop.
    await discardBody(response);

    const location = response.headers.get('location');
    if (!location) throw new StreamUrlError('redirect missing location');
    if (hop >= MAX_STREAM_REDIRECTS) throw new StreamUrlError('too many redirects');

    // Resolve relative/protocol-relative Locations, then re-check scheme + host.
    current = validate(new URL(location, current).href).href;
  }
}

/** True when a URL looks like a subtitle file (VTT or ASS/SSA). */
export function isSubtitleUrl(url: string): boolean {
  try {
    return /\.(vtt|ass|ssa)(\?|$)/i.test(new URL(url).pathname);
  } catch {
    return /\.(vtt|ass|ssa)(\?|$)/i.test(url);
  }
}

/** Build `base?url=...`, adding the HLS key when one is configured. */
export function buildProxyUrl(proxyBase: string, upstreamUrl: string, key?: string | null): string {
  const u = new URL(proxyBase);
  u.searchParams.set('url', upstreamUrl);
  if (key) u.searchParams.set('k', key);
  return u.href;
}

/**
 * Rewrite every segment/key/subtitle reference in a playlist to a proxy URL.
 * The HLS key is attached only to `/hls` URLs; subtitle URLs stay keyless
 * because `/vtt` is allowlist-gated.
 */
export function rewritePlaylist(
  body: string,
  playlistUrl: string,
  proxyBase: string,
  vttBase: string,
  key?: string | null
): string {
  const subtitleUrl = (abs: string) => `${vttBase}?url=${encodeURIComponent(abs)}`;
  const mediaUrl = (abs: string) => buildProxyUrl(proxyBase, abs, key);

  return body
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          try {
            const abs = new URL(uri, playlistUrl).href;
            if (line.includes('TYPE=SUBTITLES') || isSubtitleUrl(abs)) {
              return `URI="${subtitleUrl(abs)}"`;
            }
            return `URI="${mediaUrl(abs)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }
      try {
        const abs = new URL(trimmed, playlistUrl).href;
        return isSubtitleUrl(abs) ? subtitleUrl(abs) : mediaUrl(abs);
      } catch {
        return line;
      }
    })
    .join('\n');
}

/**
 * Unwrap the 1x1 PNG wrapper some CDNs prepend to MPEG-TS segments.
 * Returns the input unchanged when it is not a wrapped segment.
 */
export function stripPngWrapper(buf: Uint8Array): Uint8Array {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    for (let i = 0; i + 3 < buf.length; i++) {
      if (buf[i] === 0x49 && buf[i + 1] === 0x45 && buf[i + 2] === 0x4e && buf[i + 3] === 0x44) {
        // Skip the IEND chunk (type + CRC) and require the MPEG-TS sync byte.
        if (i + 8 < buf.length && buf[i + 8] === 0x47) return buf.subarray(i + 8);
        break;
      }
    }
  }
  return buf;
}

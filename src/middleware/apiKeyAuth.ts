import { Context, Next } from 'hono';
import { fail } from '../lib/response';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

const PUBLIC_PATH_PREFIXES = [
  '/api/v2/hianime/watch',
  '/api/v2/hianime/hls',
  '/api/v2/hianime/poster',
  '/api/v2/hianime/vtt',
];

/**
 * Optional API key guard for /api/v2 routes.
 * When BOT_SECRET_KEY is set in environment, JSON scrape endpoints require
 * `x-api-key: <key>` (or `Authorization: Bearer <key>`).
 * Public playback/streaming routes remain accessible to browser clients.
 */
export function apiKeyAuth(configuredSecret?: string) {
  return async function apiKeyMiddleware(c: Context, next: Next) {
    const secretKey = (configuredSecret ?? process.env.BOT_SECRET_KEY ?? '').trim();
    if (!secretKey) {
      return next();
    }

    const path = new URL(c.req.url).pathname;
    if (PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    const headerKey = c.req.header('x-api-key');
    const authHeader = c.req.header('authorization');
    const bearerKey = authHeader?.replace(/^Bearer\s+/i, '').trim();

    const providedKey = headerKey || bearerKey || '';

    if (!providedKey || !timingSafeEqual(providedKey, secretKey)) {
      return fail(c, 'Unauthorized: Invalid or missing x-api-key', 401);
    }

    return next();
  };
}

import { Context, Next } from 'hono';
import { fail } from '../lib/response';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const windowMs = 60 * 1000; // 1 minute window
const defaultMax = 150; // max requests per window
const store = new Map<string, RateLimitRecord>();

// Clean up stale entries every 2 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetTime < now) {
        store.delete(key);
      }
    }
  },
  2 * 60 * 1000
).unref?.();

/**
 * Extracts client IP from standard proxy headers (CF-Connecting-IP, X-Real-IP, X-Forwarded-For).
 */
export function getClientIp(c: Context): string {
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0].trim();
    if (first) return first;
  }

  return 'anonymous';
}

/**
 * Sliding window rate limiter for API endpoints to prevent scraper abuse and DoS.
 */
export function rateLimiter(options: { max?: number; windowMs?: number } = {}) {
  const envLimit = Number(process.env.RATE_LIMIT_PER_MINUTE);
  const max = options.max ?? (Number.isFinite(envLimit) && envLimit > 0 ? envLimit : defaultMax);
  const winMs = options.windowMs ?? windowMs;

  return async function rateLimitMiddleware(c: Context, next: Next) {
    const ip = getClientIp(c);
    const now = Date.now();

    let record = store.get(ip);
    if (!record || record.resetTime < now) {
      record = { count: 1, resetTime: now + winMs };
      store.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSeconds));

    if (record.count > max) {
      c.header('Retry-After', String(resetSeconds));
      return fail(c, 'Too many requests, please try again later', 429);
    }

    await next();
  };
}

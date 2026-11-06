import { next } from '@vercel/edge';

export const config = {
  matcher: '/api/:path*',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Api-Key',
  'Access-Control-Max-Age': '600',
};

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

export default function middleware(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const expected = (process.env.BOT_SECRET_KEY || '').trim();
  // When BOT_SECRET_KEY is unset, JSON scrape routes are open for self-hosters and preview deployments
  if (!expected) {
    return next();
  }

  const path = new URL(request.url).pathname;

  // Public catalog and playback endpoints: HTML watch page + HLS/VTT/poster proxies
  if (
    path === '/api' ||
    path === '/api/' ||
    path === '/api/health' ||
    path === '/api/ping' ||
    PUBLIC_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'))
  ) {
    return next();
  }

  const headerKey = request.headers.get('x-api-key');
  const authHeader = request.headers.get('authorization');
  const bearerKey = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const providedKey = (headerKey || bearerKey || '').trim();

  if (!providedKey || !timingSafeEqual(providedKey, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or Missing API Key' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  return next();
}

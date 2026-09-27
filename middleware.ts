import { next } from '@vercel/edge';

export const config = {
  matcher: '/api/:path*',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With, X-Api-Key',
  'Access-Control-Max-Age': '600',
};

export default function middleware(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Public playback endpoints (no API key): HTML watch page + HLS proxy.
  // Host allowlisting inside those handlers prevents open-proxy abuse.
  const path = new URL(request.url).pathname;
  if (
    path === '/api/v2/hianime/hls' ||
    path.startsWith('/api/v2/hianime/hls/') ||
    path === '/api/v2/hianime/watch' ||
    path.startsWith('/api/v2/hianime/watch/')
  ) {
    return next();
  }

  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.BOT_SECRET_KEY;

  if (!expected || apiKey !== expected) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or Missing API Key' }),
      {
        status: 401,
        headers: {
          'content-type': 'application/json',
          ...corsHeaders,
        },
      },
    );
  }

  return next();
}

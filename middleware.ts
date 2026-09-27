import { next } from '@vercel/edge';

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  const authHeader = request.headers.get('x-api-key');
  if (authHeader !== process.env.BOT_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or Missing API Key' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }

  return next(); // continues to the API route
}

export const config = {
  matcher: '/api/:path*', // Only protect the API routes
};

export default function middleware(request: Request) {
  // Get the secret key from the request headers
  const authHeader = request.headers.get('x-api-key');

  // Allow preflight requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  // Check if the provided key matches your Vercel Environment Variable
  if (authHeader !== process.env.BOT_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or Missing API Key' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
}

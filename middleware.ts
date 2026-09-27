import { NextResponse } from 'next/server';

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request: Request) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200 });
  }

  const authHeader = request.headers.get('x-api-key');
  if (authHeader !== process.env.BOT_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or Missing API Key' },
      { status: 401 },
    );
  }

  return NextResponse.next(); // required — without this the route never runs
}

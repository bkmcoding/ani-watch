import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import hiAnimeRoutes from './routes/routes';
import { AppError } from './utils/errors';
import { fail, success } from './utils/response';
import { logger } from 'hono/logger';
import config from './config/config';
import { faviconResponse, SITE_NAME, SITE_TAGLINE } from './utils/brand';
import landingController from './controllers/landing.controller';
import browseController from './controllers/browse.controller';

const app = new Hono();
const origins = config.origin.includes(',')
  ? config.origin.split(',').map((o) => o.trim())
  : config.origin === '*'
    ? '*'
    : [config.origin];

app.use('*', compress());

app.use(
  '*',
  cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Api-Key'],
    exposeHeaders: ['Content-Length', 'X-Request-Id', 'Cache-Control'],
    maxAge: 600,
    credentials: true,
  })
);

if (!config.isProduction || config.enableLogging) {
  app.use('/api/v2/*', logger());
}

/** Client/CDN caching for scrape-backed JSON GETs (server also has short TTL memory cache). */
app.use('/api/v2/*', async (c, next) => {
  await next();
  if (c.req.method !== 'GET') return;
  const path = new URL(c.req.url).pathname;
  if (
    path.includes('/search') ||
    path.includes('/suggestion') ||
    path.includes('/animes/') ||
    /\/anime\/[^/]+\/episodes/.test(path) ||
    /\/anime\/[^/]+$/.test(path) ||
    path.endsWith('/home') ||
    path.endsWith('/hianime/home')
  ) {
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  } else if (path.includes('/episode/sources') || path.includes('/episode/servers')) {
    c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  }
});

async function htmlRoute(c: Context, fn: (c: Context) => Promise<Response>) {
  try {
    return await fn(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
}

app.get('/', (c) => htmlRoute(c, landingController));
app.get('/browse', (c) => htmlRoute(c, browseController));

/** JSON catalog for bots / curl — HTML lives at / and /browse. */
app.get('/api', (c: Context) => {
  return success(c, {
    name: SITE_NAME,
    by: 'wab',
    tagline: SITE_TAGLINE,
    pages: {
      home: '/',
      browse: '/browse',
    },
    auth: 'Send header x-api-key (BOT_SECRET_KEY) for /api/v2 JSON routes. /watch, /watch/play, /watch/episodes, /hls, and /poster are public.',
    flow: [
      'GET /api/v2/hianime/search?keyword=',
      'GET /api/v2/hianime/anime/:id/episodes',
      'GET /api/v2/hianime/episode/sources?animeEpisodeId=&category=sub|dub',
      'Open data.link (or data.tracks.sub|dub.link) in a browser to play',
      'Use data.navigation.prev|next or /watch/play to change episodes',
      'Player episode picker: GET /api/v2/hianime/watch/episodes?anime=',
    ],
    endpoints: {
      ping: '/ping',
      favicon: '/favicon.svg',
      search: '/api/v2/hianime/search?keyword=',
      anime: '/api/v2/anime/:id',
      episodes: '/api/v2/hianime/anime/:id/episodes',
      episodesWithPoster: '/api/v2/hianime/anime/:id/episodes?poster=1',
      servers: '/api/v2/hianime/episode/servers?animeEpisodeId=',
      sources: '/api/v2/hianime/episode/sources?animeEpisodeId=&category=',
      watch: '/api/v2/hianime/watch',
      watchPlay: '/api/v2/hianime/watch/play?animeEpisodeId=&category=',
      watchEpisodes: '/api/v2/hianime/watch/episodes?anime=',
      hls: '/api/v2/hianime/hls?url=',
      poster: '/api/v2/hianime/poster?url=',
    },
  });
});

app.get('/ping', (c: Context) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.isVercel ? 'vercel' : 'self-hosted',
  });
});

app.get('/favicon.ico', () => faviconResponse());
app.get('/favicon.svg', () => faviconResponse());

app.route('/api/v2', hiAnimeRoutes);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return fail(c, err.message, err.statusCode, err.details);
  }

  console.error('Unexpected Error:', err.message);
  if (!config.isProduction) {
    console.error('Stack:', err.stack);
  }

  return fail(c, 'Internal server error', 500);
});

app.notFound((c: Context) => {
  return fail(c, 'Route not found', 404);
});

export default app;

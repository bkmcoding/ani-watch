import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import hiAnimeRoutes from './routes/routes';
import { AppError } from './utils/errors';
import { fail, success } from './utils/response';
import { logger } from 'hono/logger';
import config from './config/config';

import { faviconResponse, SITE_NAME, SITE_TAGLINE } from './utils/brand';

const app = new Hono();
const origins = config.origin.includes(',')
  ? config.origin.split(',').map(o => o.trim())
  : config.origin === '*'
    ? '*'
    : [config.origin];

app.use(
  '*',
  cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Api-Key'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 600,
    credentials: true,
  })
);

if (!config.isProduction || config.enableLogging) {
  app.use('/api/v2/*', logger());
}

/** JSON entrypoint — navigate the API via these routes (no HTML frontend). */
app.get('/', (c: Context) => {
  return success(c, {
    name: SITE_NAME,
    by: 'wab',
    tagline: SITE_TAGLINE,
    auth: 'Send header x-api-key (BOT_SECRET_KEY) for /api/v2 JSON routes. /watch, /watch/play, and /hls are public.',
    flow: [
      'GET /api/v2/hianime/search?keyword=',
      'GET /api/v2/hianime/anime/:id/episodes',
      'GET /api/v2/hianime/episode/sources?animeEpisodeId=&category=sub|dub',
      'Open data.link (or data.tracks.sub|dub.link) in a browser to play',
      'Use data.navigation.prev|next or /watch/play to change episodes',
    ],
    endpoints: {
      ping: '/ping',
      favicon: '/favicon.svg',
      search: '/api/v2/hianime/search?keyword=',
      anime: '/api/v2/anime/:id',
      episodes: '/api/v2/hianime/anime/:id/episodes',
      servers: '/api/v2/hianime/episode/servers?animeEpisodeId=',
      sources: '/api/v2/hianime/episode/sources?animeEpisodeId=&category=',
      watch: '/api/v2/hianime/watch',
      watchPlay: '/api/v2/hianime/watch/play?animeEpisodeId=&category=',
      hls: '/api/v2/hianime/hls?url=',
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

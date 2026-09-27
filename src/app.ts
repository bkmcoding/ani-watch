import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import hiAnimeRoutes from './routes/routes';
import { AppError } from './utils/errors';
import { fail } from './utils/response';
import { logger } from 'hono/logger';
import config from './config/config';
import landingController from './controllers/landing.controller';
import browseController from './controllers/browse.controller';

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

app.get('/', async (c: Context) => {
  try {
    return await landingController(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});

app.get('/browse', async (c: Context) => {
  try {
    return await browseController(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});

app.get('/ping', (c: Context) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.isVercel ? 'vercel' : 'self-hosted',
  });
});

app.get('/favicon.ico', (c: Context) => {
  return c.body(null, 204);
});

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

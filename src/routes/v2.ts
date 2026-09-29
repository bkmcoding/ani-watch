import { Hono } from 'hono';
import handler from '../lib/handler';

import homepageController from '../handlers/catalog/home';
import detailpageController from '../handlers/catalog/detail';
import listpageController from '../handlers/catalog/list';
import searchController from '../handlers/catalog/search';
import suggestionController from '../handlers/catalog/suggestion';
import charactersController from '../handlers/catalog/characters';
import characterDetailController from '../handlers/catalog/characterDetail';
import episodesController from '../handlers/playback/episodes';
import serversController from '../handlers/playback/servers';
import sourcesController from '../handlers/playback/sources';
import hlsProxyController from '../handlers/media/hlsProxy';
import posterProxyController from '../handlers/media/posterProxy';
import vttProxyController from '../handlers/media/vttProxy';
import watchController from '../handlers/pages/watch';
import watchPlayController from '../handlers/pages/watchPlay';
import watchEpisodesController from '../handlers/pages/watchEpisodes';
import allGenresController from '../handlers/catalog/genres';
import { AppError } from '../lib/errors';
import { fail } from '../lib/response';
import nextEpisodeScheduleController from '../handlers/catalog/nextEpisodeSchedule';
import filterController from '../handlers/catalog/filter';
import filterOptions from '../lib/filter';
import newsController from '../handlers/catalog/news';
import randomController from '../handlers/catalog/random';
import schedulesController from '../handlers/catalog/schedules';
import topSearchController from '../handlers/catalog/topSearch';

const router = new Hono();

router.get('/home', handler(homepageController));
router.get('/hianime/home', handler(homepageController));
router.get('/top-search', handler(topSearchController));
router.get('/schedules', handler(schedulesController));
router.get('/schedule/next/:id', handler(nextEpisodeScheduleController));
router.get('/anime/:id', handler(detailpageController));
router.get('/animes/:query/:category?', handler(listpageController));
router.get('/search', handler(searchController));
router.get('/hianime/search', handler(searchController));
router.get(
  '/filter/options',
  handler(async () => filterOptions)
);
router.get('/filter', handler(filterController));
router.get('/suggestion', handler(suggestionController));
router.get('/characters/:id', handler(charactersController));
router.get('/character/:id', handler(characterDetailController));
router.get('/episodes/:id', handler(episodesController));
router.get('/hianime/anime/:id/episodes', handler(episodesController));
router.get('/anime/:id/episodes', handler(episodesController));
router.get('/hianime/episode/servers', handler(serversController));
router.get('/episode/servers', handler(serversController));
router.get('/hianime/episode/sources', handler(sourcesController));
router.get('/episode/sources', handler(sourcesController));
// Raw HLS proxy (playlist rewrite + PNG unwrap) — not JSON-wrapped
router.get('/hianime/hls', async (c) => {
  try {
    return await hlsProxyController(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});
// Subtitle proxy (VTT/ASS) — accepts any https:// CDN, forced text/vtt response
router.get('/hianime/vtt', async (c) => {
  try {
    return await vttProxyController(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});
// Poster proxy — HiAnime CDN hotlink bypass (allowlisted hosts)
router.get('/hianime/poster', async (c) => {
  try {
    return await posterProxyController(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});
// Public episode hop — resolves sources then redirects to /watch (used by Prev/Next)
router.get('/hianime/watch/play', async (c) => {
  try {
    return await watchPlayController(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});
// Public compact episode list for the watch player picker
router.get('/hianime/watch/episodes', async (c) => {
  try {
    return await watchEpisodesController(c);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});
// Browser player page — open this link; it plays instead of downloading .m3u8
router.get('/hianime/watch', async (c) => {
  try {
    return await watchController(c);
  } catch (error: unknown) {
    // Return a user-facing HTML error page instead of a JSON blob.
    // The /watch route is opened in a browser tab, so JSON is confusing.
    const msg =
      error instanceof AppError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Something went wrong loading this episode.';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>ani.watch — Episode unavailable</title>
  <style>
    :root { --bg: #0a0c10; --ink: #e8edf5; --muted: #8b95a8; --accent: #3dd6c6; --danger: #ff7b72; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100dvh; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; display: grid; place-items: center; }
    .card { max-width: 480px; width: 90%; text-align: center; padding: 2rem 1.5rem; }
    h1 { font-size: 1.4rem; margin: 0 0 .75rem; color: var(--danger); }
    p { color: var(--muted); font-size: .95rem; margin: 0 0 1.5rem; }
    code { background: rgba(255,255,255,.07); padding: .15em .4em; border-radius: 6px; font-size: .88rem; word-break: break-all; }
    a { color: var(--accent); text-decoration: none; font-weight: 600; border: 1px solid rgba(61,214,198,.35); padding: .55em 1.2em; border-radius: 999px; display: inline-block; }
    a:hover { background: rgba(61,214,198,.15); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Episode unavailable</h1>
    <p><code>${msg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></p>
    <a href="/browse">← Back to browse</a>
  </div>
</body>
</html>`;
    const status = error instanceof AppError ? error.statusCode : 500;
    return new Response(html, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
});
router.get('/genres', handler(allGenresController));
router.get('/news', handler(newsController));
router.get('/random', handler(randomController));

export default router;

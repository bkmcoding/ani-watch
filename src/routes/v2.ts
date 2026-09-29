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
    if (error instanceof AppError) {
      return fail(c, error.message, error.statusCode, error.details);
    }
    throw error;
  }
});
router.get('/genres', handler(allGenresController));
router.get('/news', handler(newsController));
router.get('/random', handler(randomController));

export default router;

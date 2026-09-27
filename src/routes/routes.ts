import { Hono } from 'hono';
import handler from '../utils/handler';

import homepageController from '../controllers/homepage.controller';
import detailpageController from '../controllers/detailpage.controller';
import listpageController from '../controllers/listpage.controller';
import searchController from '../controllers/search.controller';
import suggestionController from '../controllers/suggestion.controller';
import charactersController from '../controllers/characters.controller';
import characterDetailConroller from '../controllers/characterDetail.controller';
import episodesController from '../controllers/episodes.controller';
import serversController from '../controllers/servers.controller';
import sourcesController from '../controllers/sources.controller';
import hlsProxyController from '../controllers/hlsProxy.controller';
import allGenresController from '../controllers/allGenres.controller';
import { AppError } from '../utils/errors';
import { fail } from '../utils/response';
import nextEpisodeScheduleController from '../controllers/nextEpisodeSchedule.controller';
import filterController from '../controllers/filter.controller';
import filterOptions from '../utils/filter';
import newsController from '../controllers/news.controller';
import randomController from '../controllers/random.controller';
import schedulesController from '../controllers/schedules.controller';
import topSearchController from '../controllers/topSearch.controller';

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
router.get('/character/:id', handler(characterDetailConroller));
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
router.get('/genres', handler(allGenresController));
router.get('/news', handler(newsController));
router.get('/random', handler(randomController));

export default router;

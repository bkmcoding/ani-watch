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
import allGenresController from '../controllers/allGenres.controller';
import nextEpisodeScheduleController from '../controllers/nextEpisodeSchedule.controller';
import filterController from '../controllers/filter.controller';
import filterOptions from '../utils/filter';
import newsController from '../controllers/news.controller';
import randomController from '../controllers/random.controller';
import schedulesController from '../controllers/schedules.controller';
import topSearchController from '../controllers/topSearch.controller';

const router = new Hono();

router.get('/home', handler(homepageController));
router.get('/top-search', handler(topSearchController));
router.get('/schedules', handler(schedulesController));
router.get('/schedule/next/:id', handler(nextEpisodeScheduleController));
router.get('/anime/:id', handler(detailpageController));
router.get('/animes/:query/:category?', handler(listpageController));
router.get('/search', handler(searchController));
router.get(
  '/filter/options',
  handler(async () => filterOptions)
);
router.get('/filter', handler(filterController));
router.get('/suggestion', handler(suggestionController));
router.get('/characters/:id', handler(charactersController));
router.get('/character/:id', handler(characterDetailConroller));
router.get('/episodes/:id', handler(episodesController));
router.get('/genres', handler(allGenresController));
router.get('/news', handler(newsController));
router.get('/random', handler(randomController));

export default router;

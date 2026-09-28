import { Context } from 'hono';
import { extractListPage } from '../../extractors/extractListpage';
import { axiosInstance } from '../../services/axiosInstance';
import { NotFoundError, validationError } from '../../lib/errors';

/** Shape search results like aniwatch-api so Discord bots keep working. */
const searchController = async (c: Context) => {
  const keyword = c.req.query('keyword') || c.req.query('q') || c.req.query('query') || null;
  const page = c.req.query('page') || '1';

  if (!keyword) throw new validationError('query is required');

  const noSpaceKeyword = keyword.trim().toLowerCase().replace(/\s+/g, '+');

  const endpoint = `/search?keyword=${noSpaceKeyword}&page=${page}`;
  const result = await axiosInstance(endpoint, { cacheTtlMs: 90_000 });

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure given endpoint is correct');
  }

  const parsed = extractListPage(result.data);

  if (parsed.response.length < 1) {
    throw new NotFoundError('page not found');
  }

  const animes = parsed.response.map((item) => ({
    id: item.id,
    name: item.title,
    jname: item.alternativeTitle,
    poster: item.poster,
    duration: item.duration,
    type: item.type,
    rating: null as string | null,
    episodes: item.episodes,
  }));

  return {
    animes,
    // Keep legacy field used by this repo's README / older clients
    response: parsed.response,
    pageInfo: parsed.pageInfo,
    currentPage: parsed.pageInfo.currentPage,
    hasNextPage: parsed.pageInfo.hasNextPage,
    totalPages: parsed.pageInfo.totalPages,
    top10: parsed.top10,
    genres: parsed.genres,
  };
};

export default searchController;

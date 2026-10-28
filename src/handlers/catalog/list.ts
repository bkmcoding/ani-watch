import { Context } from 'hono';
import { extractListPage, ListPageResponse } from '../../extractors/extractListpage';
import { axiosInstance } from '../../services/axiosInstance';
import { NotFoundError, validationError } from '../../lib/errors';

const listpageController = async (c: Context): Promise<ListPageResponse> => {
  const validateQueries = [
    'top-airing',
    'most-popular',
    'most-favorite',
    'completed',
    'recently-added',
    'recently-updated',
    'top-upcoming',
    'genre',
    'producer',
    'az-list',
    'subbed-anime',
    'dubbed-anime',
    'movie',
    'tv',
    'ova',
    'ona',
    'special',
    'events',
  ];
  const query = c.req.param('query')?.toLowerCase() || '';

  if (!validateQueries.includes(query))
    throw new validationError('invalid query', { validateQueries });

  let category = c.req.param('category') || null;

  const rawPage = c.req.query('page') || '1';
  const pageNum = Math.max(1, parseInt(rawPage, 10) || 1);

  if ((query === 'genre' || query === 'producer') && !category) {
    throw new validationError(`category is require for query ${query}`);
  }
  if (query !== 'genre' && query !== 'producer' && query !== 'az-list' && category) {
    category = null;
  }

  let normalizeCategory = category ? category.replace(/\s+/g, '-').toLowerCase() : null;
  if (normalizeCategory === 'martial-arts') normalizeCategory = 'marial-arts';

  if (normalizeCategory && (!/^[a-z0-9_-]+$/i.test(normalizeCategory) || normalizeCategory.includes('..'))) {
    throw new validationError('Invalid category parameter');
  }

  const endpoint = normalizeCategory
    ? `/${query}/${encodeURIComponent(normalizeCategory)}?page=${pageNum}`
    : `/${query}?page=${pageNum}`;

  const result = await axiosInstance(endpoint, { cacheTtlMs: 120_000 });

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure given endpoint is correct');
  }
  const response = extractListPage(result.data);

  if (response.response.length < 1) throw new NotFoundError();
  return response;
};

export default listpageController;

import { Context } from 'hono';
import { extractListPage, ListPageResponse } from '../extractor/extractListpage';
import { axiosInstance } from '../services/axiosInstance';
import { NotFoundError, validationError } from '../utils/errors';

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

  const page = c.req.query('page') || '1';

  if ((query === 'genre' || query === 'producer') && !category) {
    throw new validationError(`category is require for query ${query}`);
  }
  if (query !== 'genre' && query !== 'producer' && query !== 'az-list' && category) {
    category = null;
  }

  let nromalizeCategory = category && category.replaceAll(' ', '-').toLowerCase();
  if (nromalizeCategory === 'martial-arts') nromalizeCategory = 'marial-arts';
  const endpoint = category
    ? `/${query}/${nromalizeCategory}?page=${page}`
    : `/${query}?page=${page}`;

  const result = await axiosInstance(endpoint);

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure given endpoint is correct');
  }
  const response = extractListPage(result.data);

  if (response.response.length < 1) throw new NotFoundError();
  return response;
};

export default listpageController;

import { Context } from 'hono';
import config from '../../config/config';
import { validationError } from '../../lib/errors';
import { extractSuggestions, Suggestion } from '../../extractors/extractSuggestions';
import { axiosInstance } from '../../services/axiosInstance';

const suggestionController = async (c: Context): Promise<Suggestion[]> => {
  const keyword = c.req.query('keyword') || c.req.query('q') || c.req.query('query') || null;

  if (!keyword) throw new validationError('query is required');

  const params = new URLSearchParams({
    keyword: keyword.trim().toLowerCase(),
  });
  const endpoint = `/ajax/search/suggest?${params.toString()}`;

  const result = await axiosInstance(endpoint, {
    headers: { Referer: `${config.baseurl}/home` },
    cacheTtlMs: 60_000,
  });

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'suggestion not found');
  }

  // Parse HTML from JSON if necessary, or just use result.data if it's already HTML
  let html = '';
  try {
    const jsonData = JSON.parse(result.data);
    html = typeof jsonData?.html === 'string' ? jsonData.html : '';
  } catch {
    html = result.data;
  }
  const response = extractSuggestions(html);

  return response;
};

export default suggestionController;

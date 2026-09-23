import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { extractSuggestions, Suggestion } from '../extractor/extractSuggestions';
import { axiosInstance } from '../services/axiosInstance';

const suggestionController = async (c: Context): Promise<Suggestion[]> => {
  const keyword = c.req.query('keyword') || null;

  if (!keyword) throw new validationError('query is required');

  const noSpaceKeyword = keyword.trim().toLowerCase().replace(/\s+/g, '+');
  const endpoint = `/ajax/search/suggest?keyword=${noSpaceKeyword}`;

  const result = await axiosInstance(endpoint, {
    headers: { Referer: `${config.baseurl}/home` },
  });

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'suggestion not found');
  }

  // Parse HTML from JSON if necessary, or just use result.data if it's already HTML
  // In hianime API, suggestion ajax usually returns JSON with { status, html }
  // but my axiosInstance returns response.text() which is the raw JSON string.
  const jsonData = JSON.parse(result.data);
  const response = extractSuggestions(jsonData.html);

  return response;
};

export default suggestionController;

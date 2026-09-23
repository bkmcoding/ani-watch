import { Context } from 'hono';
import { axiosInstance } from '../services/axiosInstance';
import { validationError } from '../utils/errors';
import { extractNews, NewsResponse } from '../extractor/extractNews';

const newsController = async (c: Context): Promise<NewsResponse> => {
  const page = c.req.query('page') || '1';

  console.log(`Fetching news page ${page} from external API...`);
  const endpoint = page === '1' ? '/news' : `/news?page=${page}`;
  const result = await axiosInstance(endpoint);

  if (!result.success || !result.data) {
    console.error('News fetch failed:', result.message);
    throw new validationError(result.message || 'Failed to fetch news');
  }

  return extractNews(result.data);
};

export default newsController;

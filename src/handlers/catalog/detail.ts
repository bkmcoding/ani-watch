import { Context } from 'hono';
import { extractDetailpage } from '../../extractors/extractDetailpage';
import { axiosInstance } from '../../services/axiosInstance';
import { validationError } from '../../lib/errors';
import { DetailAnime } from '../../types/anime';

const detailpageController = async (c: Context): Promise<DetailAnime> => {
  const id = c.req.param('id');

  const result = await axiosInstance(`/${id}`, { cacheTtlMs: 180_000 });
  if (!result.success || !result.data) {
    throw new validationError(
      result.message || 'Failed to fetch detail page',
      'maybe id is incorrect : ' + id
    );
  }
  return extractDetailpage(result.data);
};

export default detailpageController;

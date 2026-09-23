import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { extractEpisodes, Episode } from '../extractor/extractEpisodes';
import { axiosInstance } from '../services/axiosInstance';

const episodesController = async (c: Context): Promise<Episode[]> => {
  const id = c.req.param('id');

  if (!id) throw new validationError('id is required');

  const idNum = id.split('-').at(-1);
  const ajaxUrl = `/ajax/v2/episode/list/${idNum}`;

  const result = await axiosInstance(ajaxUrl, {
    headers: { Referer: `${config.baseurl}/watch/${id}` },
  });

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure the id is correct', {
      validIdEX: 'one-piece-100',
    });
  }

  const response = extractEpisodes(result.data);
  return response;
};

export default episodesController;

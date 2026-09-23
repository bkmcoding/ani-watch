import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { extractCharacters, CharactersResponse } from '../extractor/extractCharacters';
import { axiosInstance } from '../services/axiosInstance';

const charactersController = async (c: Context): Promise<CharactersResponse> => {
  try {
    const id = c.req.param('id');
    const page = c.req.query('page') || '1';

    if (!id) throw new validationError('id is required');

    const idNum = id.split('-').pop();
    const endpoint = `/ajax/character/list/${idNum}?page=${page}`;

    const result = await axiosInstance(endpoint, {
      headers: { Referer: `${config.baseurl}/home` },
    });

    if (!result.success || !result.data) {
      throw new validationError(result.message || 'characters not found');
    }

    const response = extractCharacters(result.data);

    return response;
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log(err.message);
    } else {
      console.log(err);
    }

    throw new validationError('characters not found');
  }
};

export default charactersController;

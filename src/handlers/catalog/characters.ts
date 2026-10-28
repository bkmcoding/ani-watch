import { Context } from 'hono';
import config from '../../config/config';
import { AppError, validationError } from '../../lib/errors';
import { extractCharacters, CharactersResponse } from '../../extractors/extractCharacters';
import { axiosInstance } from '../../services/axiosInstance';

const charactersController = async (c: Context): Promise<CharactersResponse> => {
  try {
    const id = c.req.param('id');
    const rawPage = c.req.query('page') || '1';
    const pageNum = Math.max(1, parseInt(rawPage, 10) || 1);

    if (!id) throw new validationError('id is required');

    const idNum = id.split('-').pop();
    if (!idNum || !/^\d+$/.test(idNum)) {
      throw new validationError('Invalid anime character list id');
    }
    const endpoint = `/ajax/character/list/${idNum}?page=${pageNum}`;

    const result = await axiosInstance(endpoint, {
      headers: { Referer: `${config.baseurl}/home` },
    });

    if (!result.success || !result.data) {
      throw new validationError(result.message || 'characters not found');
    }

    const response = extractCharacters(result.data);

    return response;
  } catch (err: unknown) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err instanceof Error) {
      console.log(err.message);
    } else {
      console.log(err);
    }

    throw new validationError('characters not found');
  }
};

export default charactersController;

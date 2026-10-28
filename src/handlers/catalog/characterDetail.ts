import { Context } from 'hono';
import { extractCharacterDetail, CharacterDetail } from '../../extractors/extractCharacterDetail';
import { axiosInstance } from '../../services/axiosInstance';
import { validationError } from '../../lib/errors';

const characterDetailConroller = async (c: Context): Promise<CharacterDetail> => {
  const id = c.req.param('id');

  if (!id || id.includes('..') || !/^[a-zA-Z0-9_\-.:]+$/.test(id)) {
    throw new validationError('Invalid character id');
  }

  const result = await axiosInstance(`/${id.replace(':', '/')}`);
  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure given endpoint is correct');
  }

  const response = extractCharacterDetail(result.data);

  return response;
};

export default characterDetailConroller;

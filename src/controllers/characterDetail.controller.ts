import { Context } from 'hono';
import { extractCharacterDetail, CharacterDetail } from '../extractor/extractCharacterDetail';
import { axiosInstance } from '../services/axiosInstance';
import { validationError } from '../utils/errors';

const characterDetailConroller = async (c: Context): Promise<CharacterDetail> => {
  const id = c.req.param('id');

  if (!id) throw new validationError('id is required');

  const result = await axiosInstance(`/${id.replace(':', '/')}`);
  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure given endpoint is correct');
  }

  const response = extractCharacterDetail(result.data);

  return response;
};

export default characterDetailConroller;

import { axiosInstance } from '../../services/axiosInstance';
import { validationError } from '../../lib/errors';
import { extractHomepage } from '../../extractors/extractHomepage';
import { HomePage } from '../../types/anime';

const homepageController = async (): Promise<HomePage> => {
  console.log('Fetching homepage data from external API...');
  const result = await axiosInstance('/home', { cacheTtlMs: 120_000 });

  if (!result.success || !result.data) {
    console.error('Homepage fetch failed:', result.message);
    throw new validationError(result.message || 'Failed to fetch homepage');
  }

  return extractHomepage(result.data);
};

export default homepageController;

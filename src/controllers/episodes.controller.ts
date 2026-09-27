import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { extractEpisodes } from '../extractor/extractEpisodes';
import { extractDetailpage } from '../extractor/extractDetailpage';
import { axiosInstance } from '../services/axiosInstance';
import { animeNumericId, fetchTheme, htmlFromAjax } from '../utils/themeAjax';

const episodesController = async (c: Context) => {
  const id = c.req.param('id');

  if (!id) throw new validationError('id is required');

  const idNum = animeNumericId(id);

  const [listResult, detailResult] = await Promise.all([
    fetchTheme(`episode/list/${idNum}`, `/watch/${id}`),
    axiosInstance(`/${id}`),
  ]);

  if (!listResult.success || !listResult.data) {
    throw new validationError(listResult.message || 'make sure the id is correct', {
      validIdEX: 'one-piece-1',
    });
  }

  const poster =
    detailResult.success && detailResult.data
      ? extractDetailpage(detailResult.data).poster
      : null;

  const extracted = extractEpisodes(htmlFromAjax(listResult.data));
  const episodes = extracted.map((ep) => ({
    title: ep.title,
    alternativeTitle: ep.alternativeTitle,
    episodeId: ep.id?.includes('::') ? ep.id.replace('::', '?') : ep.id,
    number: ep.episodeNumber,
    isFiller: ep.isFiller,
    poster,
    // legacy fields
    id: ep.id,
    episodeNumber: ep.episodeNumber,
  }));

  return {
    totalEpisodes: episodes.length,
    poster,
    episodes,
  };
};

export default episodesController;

import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { extractEpisodes } from '../extractor/extractEpisodes';
import { animeNumericId, fetchTheme, htmlFromAjax } from '../utils/themeAjax';

const episodesController = async (c: Context) => {
  const id = c.req.param('id');

  if (!id) throw new validationError('id is required');

  const idNum = animeNumericId(id);
  const result = await fetchTheme(`episode/list/${idNum}`, `/watch/${id}`);

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure the id is correct', {
      validIdEX: 'one-piece-1',
    });
  }

  const extracted = extractEpisodes(htmlFromAjax(result.data));
  const episodes = extracted.map((ep) => ({
    title: ep.title,
    alternativeTitle: ep.alternativeTitle,
    episodeId: ep.id?.includes('::') ? ep.id.replace('::', '?') : ep.id,
    number: ep.episodeNumber,
    isFiller: ep.isFiller,
    // legacy fields
    id: ep.id,
    episodeNumber: ep.episodeNumber,
  }));

  return {
    totalEpisodes: episodes.length,
    episodes,
  };
};

export default episodesController;

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
  const wantPoster =
    c.req.query('poster') === '1' || c.req.query('poster') === 'true';

  const listResult = await fetchTheme(`episode/list/${idNum}`, `/watch/${id}`);

  if (!listResult.success || !listResult.data) {
    throw new validationError(listResult.message || 'make sure the id is correct', {
      validIdEX: 'one-piece-1',
    });
  }

  let poster: string | null = null;
  if (wantPoster) {
    try {
      const detailResult = await axiosInstance(`/${id}`, { cacheTtlMs: 180_000 });
      if (detailResult.success && detailResult.data) {
        poster = extractDetailpage(detailResult.data).poster;
      }
    } catch {
      poster = null;
    }
  }

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

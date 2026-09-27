import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { extractEpisodes } from '../extractor/extractEpisodes';
import { axiosInstance } from '../services/axiosInstance';

function htmlFromAjax(payload: string): string {
  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed?.html === 'string') return parsed.html;
  } catch {
    // raw HTML
  }
  return payload;
}

const episodesController = async (c: Context) => {
  const id = c.req.param('id');

  if (!id) throw new validationError('id is required');

  const idNum = id.split('-').at(-1);
  const ajaxUrl = `/ajax/v2/episode/list/${idNum}`;

  const result = await axiosInstance(ajaxUrl, {
    headers: {
      Referer: `${config.baseurl}/watch/${id}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!result.success || !result.data) {
    throw new validationError(result.message || 'make sure the id is correct', {
      validIdEX: 'one-piece-100',
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

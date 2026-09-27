import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { extractEpisodes } from '../extractor/extractEpisodes';
import { animeNumericId, fetchTheme, htmlFromAjax } from '../utils/themeAjax';

function normalizeEpisodeId(raw: string | null): string | null {
  if (!raw) return null;
  return raw.includes('::') ? raw.replace('::', '?') : raw;
}

/**
 * Public compact episode list for the watch player picker.
 * Metadata only — no streams. Theme AJAX is already TTL-cached.
 */
const watchEpisodesController = async (c: Context) => {
  const anime = (c.req.query('anime') || c.req.query('id') || '').trim();
  if (!anime || anime.length > 180 || /[\s<>"']/.test(anime)) {
    throw new validationError('anime query param required (slug like one-piece-100)');
  }

  let idNum: string;
  try {
    idNum = animeNumericId(anime);
  } catch {
    throw new validationError('invalid anime slug', { anime });
  }

  const listResult = await fetchTheme(`episode/list/${idNum}`, `/watch/${anime}`);
  if (!listResult.success || !listResult.data) {
    throw new validationError(listResult.message || 'could not load episode list', {
      anime,
    });
  }

  const extracted = extractEpisodes(htmlFromAjax(listResult.data));
  const episodes = extracted.map((ep) => ({
    n: ep.episodeNumber,
    id: normalizeEpisodeId(ep.id),
    title: ep.title,
    filler: ep.isFiller,
  }));

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        animeId: anime,
        total: episodes.length,
        episodes,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};

export default watchEpisodesController;

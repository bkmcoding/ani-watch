import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { resolveEpisodePlayback } from '../services/episodeSources';
import { requestOrigin } from '../utils/streamUrls';

const sourcesController = async (c: Context) => {
  const animeEpisodeId =
    c.req.query('animeEpisodeId') || c.req.query('episodeId') || c.req.param('episodeId');
  const server = (c.req.query('server') || 'hd-1').toLowerCase();
  const preferred = (c.req.query('category') || c.req.query('type') || 'sub').toLowerCase();

  if (!animeEpisodeId) {
    throw new validationError('animeEpisodeId is required', {
      example: 'one-piece-1?ep=1',
    });
  }

  try {
    return await resolveEpisodePlayback(requestOrigin(c), animeEpisodeId, {
      server,
      category: preferred,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve sources';
    throw new validationError(message, { animeEpisodeId });
  }
};

export default sourcesController;

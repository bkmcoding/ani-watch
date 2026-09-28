import { Context } from 'hono';
import { validationError } from '../../lib/errors';
import { resolveEpisodePlayback } from '../../services/episodeSources';
import { requestOrigin } from '../../lib/streamUrls';

/**
 * Public entry for episode hopping from the watch player.
 * Resolves streams and 302-redirects to the HTML /watch page.
 * Same surface as sharing a watch link — not a meaningful extra secret leak.
 */
const watchPlayController = async (c: Context) => {
  const animeEpisodeId =
    c.req.query('animeEpisodeId') || c.req.query('episodeId') || undefined;
  const category = (c.req.query('category') || c.req.query('t') || 'sub').toLowerCase();
  const server = (c.req.query('server') || 'hd-1').toLowerCase();

  if (!animeEpisodeId) {
    throw new validationError('animeEpisodeId is required');
  }

  try {
    const playback = await resolveEpisodePlayback(requestOrigin(c), animeEpisodeId, {
      server,
      category,
    });
    return c.redirect(playback.link, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to open episode';
    throw new validationError(message, { animeEpisodeId });
  }
};

export default watchPlayController;

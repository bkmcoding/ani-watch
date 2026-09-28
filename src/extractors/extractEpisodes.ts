import { load } from 'cheerio';

export interface Episode {
  title: string | null;
  alternativeTitle: string | null;
  id: string | null;
  isFiller: boolean;
  episodeNumber: number;
}

function watchPathFromHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    if (/^https?:\/\//i.test(href)) {
      const u = new URL(href);
      return `${u.pathname.replace(/^\/watch\/?/, '')}${u.search}`.replace(/^\//, '');
    }
  } catch {
    // fall through
  }
  return href.replace(/^\/?watch\/?/, '').replace(/^\//, '');
}

export const extractEpisodes = (html: string): Episode[] => {
  const $ = load(html);
  const response: Episode[] = [];

  $('.ssl-item.ep-item, .ep-item').each((_, el) => {
    const $el = $(el);
    const hrefPath = watchPathFromHref($el.attr('href'));
    const numberAttr = $el.attr('data-number');
    const episodeNumber = numberAttr ? Number(numberAttr) : response.length + 1;

    response.push({
      title: $el.attr('title') || $el.find('.ep-name').text().trim() || null,
      alternativeTitle: $el.find('.ep-name.e-dynamic-name').attr('data-jname') || null,
      // aniwatch-style: one-piece-1?ep=1 (use ? in API, :: legacy optional)
      id: hrefPath ? hrefPath.replace('?', '::') : null,
      isFiller: $el.hasClass('ssl-item-filler') || $el.hasClass('filler'),
      episodeNumber: Number.isFinite(episodeNumber) ? episodeNumber : response.length + 1,
    });
  });

  return response;
};

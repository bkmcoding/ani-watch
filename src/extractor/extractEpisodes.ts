import { load } from 'cheerio';

export interface Episode {
  title: string | null;
  alternativeTitle: string | null;
  id: string | null;
  isFiller: boolean;
  episodeNumber: number;
}

export const extractEpisodes = (html: string): Episode[] => {
  const $ = load(html);

  const response: Episode[] = [];
  $('.ssl-item.ep-item').each((i, el) => {
    const obj: Episode = {
      title: null,
      alternativeTitle: null,
      id: null,
      isFiller: false,
      episodeNumber: i + 1,
    };
    obj.title = $(el).attr('title') || null;
    obj.id = $(el).attr('href')?.replace('/watch/', '').replace('?', '::') || null;
    obj.isFiller = $(el).hasClass('ssl-item-filler');

    obj.alternativeTitle = $(el).find('.ep-name.e-dynamic-name').attr('data-jname') || null;

    response.push(obj);
  });
  return response;
};

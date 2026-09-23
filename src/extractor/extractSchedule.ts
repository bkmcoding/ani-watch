import { load } from 'cheerio';

export interface ScheduledAnime {
  title: string | null;
  alternativeTitle: string | null;
  id: string | null;
  time: string | null;
  episode: number | null;
}

export const extractSchedule = (html: string): ScheduledAnime[] => {
  const $ = load(html);

  const response: ScheduledAnime[] = [];
  $('a').each((i, element) => {
    const obj: ScheduledAnime = {
      title: null,
      alternativeTitle: null,
      id: null,
      time: null,
      episode: null,
    };

    const el = $(element);
    obj.id = el.attr('href')?.replace('/', '') || null;
    obj.time = el.find('.time').text() || null;
    obj.title = el.find('.film-name').text().trim() || null;
    obj.alternativeTitle = el.find('.film-name').attr('data-jname')?.trim() || null;
    obj.episode = Number(el.find('.btn-play').text().trim().split('Episode ').pop()) || null;

    response.push(obj);
  });
  return response;
};

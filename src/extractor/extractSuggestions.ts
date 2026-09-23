import { load } from 'cheerio';
import { Element } from 'domhandler';

export interface Suggestion {
  title: string | null;
  alternativeTitle: string | null;
  poster: string | null;
  id: string | null;
  aired: string | null;
  type: string | null;
  duration: string | null;
}

export const extractSuggestions = (html: string): Suggestion[] => {
  const $ = load(html);

  const response: Suggestion[] = [];
  const allEl = $('.nav-item');
  const items = allEl.toArray().splice(0, allEl.length - 2);
  $(items).each((i: number, el: Element) => {
    const obj: Suggestion = {
      title: null,
      alternativeTitle: null,
      poster: null,
      id: null,
      aired: null,
      type: null,
      duration: null,
    };
    obj.id = $(el).attr('href')?.split('/').pop()?.split('?').at(0) || null;
    obj.poster = $(el).find('.film-poster-img').attr('data-src') || null;
    const titleEL = $(el).find('.film-name');
    obj.title = titleEL.text() || null;
    obj.alternativeTitle = titleEL.attr('data-jname') || null;
    const infoEl = $(el).find('.film-infor');
    obj.aired = infoEl.find('span').first().text() || null;
    obj.type = infoEl
      .contents()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: number, el: any) => {
        return el.type === 'text' && $(el).text().trim() !== '';
      })
      .text()
      .trim();
    obj.duration = infoEl.find('span').last().text() || null;

    response.push(obj);
  });
  return response;
};

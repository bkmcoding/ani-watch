import { load } from 'cheerio';

export interface Character {
  name: string | null;
  id: string | null;
  imageUrl: string | null;
  role: string | null;
  voiceActors: VoiceActor[];
}

export interface VoiceActor {
  name: string | null;
  id: string | null;
  imageUrl: string | null;
  cast?: string | null;
}

export interface CharactersResponse {
  pageInfo?: {
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
  };
  response: Character[];
}

export const extractCharacters = (html: string): CharactersResponse => {
  const $ = load(html);

  const response: Character[] = [];
  const paginationEl = $('.pre-pagination .pagination .page-item');

  let currentPage: number, hasNextPage: boolean, totalPages: number;
  if (!paginationEl.length) {
    currentPage = 1;
    hasNextPage = false;
    totalPages = 1;
  } else {
    currentPage = Number(paginationEl.find('.active .page-link').text());
    hasNextPage = !paginationEl.last().hasClass('active');
    totalPages = hasNextPage
      ? Number(paginationEl.last().find('.page-link').attr('data-url')?.split('page=').at(-1))
      : Number(paginationEl.last().find('.page-link').text());
  }

  const pageInfo = {
    totalPages,
    currentPage,
    hasNextPage,
  };

  const characters = $('.bac-item');
  if (!characters.length) return { response };
  $(characters).each((i, el) => {
    const obj: Character = {
      name: null,
      id: null,
      imageUrl: null,
      role: null,
      voiceActors: [],
    };
    const characterDetail = $(el).find('.per-info').first();
    const voiceActorsDetail = $(el).find('.per-info-xx').length
      ? $(el).find('.per-info-xx')
      : $(el).find('.rtl');

    obj.name = $(characterDetail).find('.pi-detail .pi-name a').text();
    obj.role = $(characterDetail).find('.pi-detail .pi-cast').text();
    obj.id = $(characterDetail).find('.pi-avatar').length
      ? $(characterDetail).find('.pi-avatar').attr('href')?.replace(/^\//, '').replace('/', ':') ||
        null
      : null;
    obj.imageUrl = $(characterDetail).find('.pi-avatar img').attr('data-src') || null;

    if (!voiceActorsDetail.length) {
      response.push(obj);
      return;
    }
    const hasMultiple = $(voiceActorsDetail).hasClass('per-info-xx');

    if (hasMultiple) {
      $(voiceActorsDetail)
        .find('.pix-list a')
        .each((index, item) => {
          const innerObj: VoiceActor = {
            name: null,
            id: null,
            imageUrl: null,
            cast: null,
          };
          innerObj.name = $(item).attr('title') || null;
          innerObj.id = $(item).attr('href')?.replace(/^\//, '').replace('/', ':') || null;
          innerObj.imageUrl = $(item).find('img').attr('data-src') || null;

          obj.voiceActors.push(innerObj);
        });
    } else {
      const innerObj: VoiceActor = {
        name: null,
        id: null,
        imageUrl: null,
        cast: null,
      };
      innerObj.id = $(voiceActorsDetail).find('.pi-avatar').length
        ? $(voiceActorsDetail)
            .find('.pi-avatar')
            .attr('href')
            ?.replace(/^\//, '')
            .replace('/', ':') || null
        : null;
      innerObj.imageUrl = $(voiceActorsDetail).find('.pi-avatar img').attr('data-src') || null;
      innerObj.name = $(voiceActorsDetail).find('.pi-avatar img').attr('alt') || null;
      innerObj.cast = $(voiceActorsDetail).find('.pi-cast').text();

      obj.voiceActors.push(innerObj);
    }

    response.push(obj);
  });
  return { pageInfo, response };
};

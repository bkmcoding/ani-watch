import { load } from 'cheerio';
import { Element } from 'domhandler';
import { AnimeFeatured, TrendingAnime } from '../types/anime';

export interface ListPageResponse {
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
    totalPages: number;
  };
  response: ListPageAnime[];
  top10: {
    today: TrendingAnime[] | null;
    week: TrendingAnime[] | null;
    month: TrendingAnime[] | null;
  };
  genres: string[];
}

export interface ListPageAnime extends AnimeFeatured {
  duration: string | null;
}

export const extractListPage = (html: string): ListPageResponse => {
  const $ = load(html);

  const response: ListPageAnime[] = [];
  const items = $('.flw-item');
  if (items.length < 1) {
    return {
      pageInfo: {
        currentPage: 1,
        hasNextPage: false,
        totalPages: 1,
      },
      response: [],
      top10: {
        today: [],
        week: [],
        month: [],
      },
      genres: [],
    };
  }
  $('.block_area-content.block_area-list.film_list .film_list-wrap .flw-item').each(
    (i: number, el: Element) => {
      const obj: ListPageAnime = {
        title: null,
        alternativeTitle: null,
        id: null,
        poster: null,
        episodes: {
          sub: null,
          dub: null,
          eps: null,
        },
        type: null,
        duration: null,
      };

      obj.poster = $(el).find('.film-poster .film-poster-img').attr('data-src') || null;
      obj.episodes.sub = Number($(el).find('.film-poster .tick .tick-sub').text()) || null;
      obj.episodes.dub = Number($(el).find('.film-poster .tick .tick-dub').text()) || null;

      const epsText = $(el).find('.film-poster .tick .tick-eps').length
        ? $(el).find('.film-poster .tick .tick-eps').text()
        : $(el).find('.film-poster .tick .tick-sub').text();
      obj.episodes.eps = Number(epsText) || null;

      const titleEl = $(el).find('.film-detail .film-name .dynamic-name');

      obj.title = titleEl.text();
      obj.alternativeTitle = titleEl.attr('data-jname') || null;
      const href = titleEl.attr('href') || '';
      const id = href.split('/').at(-1) || '';
      obj.id = id.includes('?ref=') ? id.split('?')[0] : id;

      obj.type = $(el).find('.fd-infor .fdi-item').first().text();
      obj.duration = $(el).find('.fd-infor .fdi-duration').text();

      response.push(obj);
    }
  );

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
      ? Number(paginationEl.last().find('.page-link').attr('href')?.split('page=').at(-1)) || 1
      : Number(paginationEl.last().find('.page-link').text()) || 1;
  }

  const pageInfo = {
    totalPages,
    currentPage,
    hasNextPage,
  };

  const $top10 = $('.block_area .cbox');
  const $genres = $('.sb-genre-list');

  const extractTopTen = (id: string): TrendingAnime[] => {
    const res = $top10
      .find(`${id} ul li`)
      .map((i: number, el: Element) => {
        const obj: TrendingAnime = {
          title: $(el).find('.film-name a').text() || null,
          rank: i + 1,
          alternativeTitle: $(el).find('.film-name a').attr('data-jname') || null,
          id: $(el).find('.film-name a').attr('href')?.split('/').pop() || null,
          poster: $(el).find('.film-poster img').attr('data-src') || null,
        };
        return obj;
      })
      .get();
    return res;
  };

  const top10 = {
    today: extractTopTen('#top-viewed-day'),
    week: extractTopTen('#top-viewed-week'),
    month: extractTopTen('#top-viewed-month'),
  };

  const genres: string[] = [];
  $($genres)
    .find('li')
    .each((i: number, el: Element) => {
      const genre = $(el).find('a').attr('title')?.toLocaleLowerCase() || '';
      if (genre) genres.push(genre);
    });

  return { pageInfo, response, top10, genres };
};

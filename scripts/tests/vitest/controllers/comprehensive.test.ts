import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Context } from 'hono';
import homepageController from '../../../../src/controllers/homepage.controller';
import detailpageController from '../../../../src/controllers/detailpage.controller';
import searchController from '../../../../src/controllers/search.controller';
import episodesController from '../../../../src/controllers/episodes.controller';
import charactersController from '../../../../src/controllers/characters.controller';
import characterDetailController from '../../../../src/controllers/characterDetail.controller';
import listpageController from '../../../../src/controllers/listpage.controller';
import topSearchController from '../../../../src/controllers/topSearch.controller';
import schedulesController from '../../../../src/controllers/schedules.controller';
import newsController from '../../../../src/controllers/news.controller';
import suggestionController from '../../../../src/controllers/suggestion.controller';
import nextEpisodeScheduleController from '../../../../src/controllers/nextEpisodeSchedule.controller';
import randomController from '../../../../src/controllers/random.controller';
import filterController from '../../../../src/controllers/filter.controller';
import allGenresController from '../../../../src/controllers/allGenres.controller';
import { mockHtmlData } from '../../data/mocks';

// Mock axiosInstance globally
vi.mock('../../../../src/services/axiosInstance', () => ({
  axiosInstance: vi.fn(),
}));

import { axiosInstance } from '../../../../src/services/axiosInstance';

const createMockContext = (
  params: Record<string, string> = {},
  query: Record<string, string> = {}
) => {
  return {
    req: {
      param: (name?: string) => (name ? params[name] : params),
      query: (name?: string) => (name ? query[name] : query),
    },
    json: vi.fn(data => data),
  } as unknown as Context;
};

describe('Controllers Comprehensive Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSuccess = (data: string) =>
    (axiosInstance as Mock).mockResolvedValue({ success: true, data });

  it('homepageController should return homepage data', async () => {
    mockSuccess(mockHtmlData.homepage);
    const result = (await homepageController()) as unknown as Record<string, unknown>;
    expect(result.spotlight).toBeDefined();
  });

  it('detailpageController should return anime details', async () => {
    mockSuccess(mockHtmlData.detail);
    const result = await detailpageController(createMockContext({ id: '123' }));
    expect(result.title).toBe('Detail Anime');
  });

  it('searchController should return search results', async () => {
    mockSuccess(mockHtmlData.search);
    const result = await searchController(createMockContext({}, { keyword: 'one' }));
    expect(result.response).toHaveLength(1);
  });

  it('episodesController should return episodes', async () => {
    mockSuccess(mockHtmlData.episodes);
    const result = await episodesController(createMockContext({ id: '123' }));
    expect(result).toHaveLength(1);
  });

  it('charactersController should return characters', async () => {
    mockSuccess(mockHtmlData.characters);
    const result = await charactersController(createMockContext({ id: '123' }));
    expect(result.response).toBeDefined();
  });

  it('characterDetailController should return character details', async () => {
    mockSuccess(mockHtmlData.characterDetail);
    const result = await characterDetailController(createMockContext({ id: '123' }));
    expect(result.name).toBe('Character Full Name');
  });

  it('listpageController should return anime list', async () => {
    mockSuccess(mockHtmlData.search);
    const result = await listpageController(createMockContext({ query: 'most-popular' }));
    expect(result.response).toBeDefined();
  });

  it('topSearchController should return top search items', async () => {
    mockSuccess(mockHtmlData.topSearch);
    const result = await topSearchController(createMockContext());
    expect(result).toHaveLength(3);
  });

  it('schedulesController should return schedules', async () => {
    mockSuccess(JSON.stringify({ html: mockHtmlData.schedule }));
    const result = await schedulesController(createMockContext());
    expect(result.data).toBeDefined();
  });

  it('newsController should return news items', async () => {
    mockSuccess(mockHtmlData.news);
    const result = await newsController(createMockContext());
    expect(result.news).toHaveLength(1);
  });

  it('suggestionController should return suggestions', async () => {
    mockSuccess(JSON.stringify({ html: mockHtmlData.suggestions }));
    const result = await suggestionController(createMockContext({}, { keyword: 'suggest' }));
    expect(result).toHaveLength(1);
  });

  it('nextEpisodeScheduleController should return next episode time', async () => {
    mockSuccess(mockHtmlData.scheduleNext);
    const result = await nextEpisodeScheduleController(createMockContext({ id: '123' }));
    expect(result).toBe('10:00');
  });

  it('filterController should handle complex queries', async () => {
    mockSuccess(mockHtmlData.search);
    const result = await filterController(createMockContext({}, { keyword: 'one' }));
    expect(result.response).toBeDefined();
  });

  it('allGenresController should return all genres', async () => {
    mockSuccess(mockHtmlData.homepage);
    const result = await allGenresController();
    expect(result).toBeDefined();
  });

  it('randomController should return random anime', async () => {
    mockSuccess(mockHtmlData.search);
    const result = await randomController(createMockContext());
    expect(result).toBeDefined();
  });
});

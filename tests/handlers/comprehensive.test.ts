import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Context } from 'hono';
import homepageController from '../../src/handlers/catalog/home';
import detailpageController from '../../src/handlers/catalog/detail';
import searchController from '../../src/handlers/catalog/search';
import episodesController from '../../src/handlers/playback/episodes';
import charactersController from '../../src/handlers/catalog/characters';
import characterDetailController from '../../src/handlers/catalog/characterDetail';
import listpageController from '../../src/handlers/catalog/list';
import topSearchController from '../../src/handlers/catalog/topSearch';
import schedulesController from '../../src/handlers/catalog/schedules';
import newsController from '../../src/handlers/catalog/news';
import suggestionController from '../../src/handlers/catalog/suggestion';
import nextEpisodeScheduleController from '../../src/handlers/catalog/nextEpisodeSchedule';
import randomController from '../../src/handlers/catalog/random';
import filterController from '../../src/handlers/catalog/filter';
import allGenresController from '../../src/handlers/catalog/genres';
import { mockHtmlData } from '../data/mocks';

// Mock axiosInstance globally
vi.mock('../../src/services/axiosInstance', () => {
  const axiosInstance = vi.fn();
  return { axiosInstance, default: axiosInstance };
});

import { axiosInstance } from '../../src/services/axiosInstance';

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

describe('Handlers Comprehensive Suite', () => {
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
    expect(result.episodes).toHaveLength(1);
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

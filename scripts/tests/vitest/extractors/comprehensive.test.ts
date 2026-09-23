import { describe, it, expect } from 'vitest';
import { extractHomepage } from '../../../../src/extractor/extractHomepage';
import { extractDetailpage } from '../../../../src/extractor/extractDetailpage';
import { extractListPage } from '../../../../src/extractor/extractListpage';
import { extractCharacters } from '../../../../src/extractor/extractCharacters';
import { extractNews } from '../../../../src/extractor/extractNews';
import { extractSchedule } from '../../../../src/extractor/extractSchedule';
import { extractEpisodes } from '../../../../src/extractor/extractEpisodes';
import { extractCharacterDetail } from '../../../../src/extractor/extractCharacterDetail';
import { extractSuggestions } from '../../../../src/extractor/extractSuggestions';
import { extractTopSearch } from '../../../../src/extractor/extractTopSearch';
import { extractNextEpisodeSchedule } from '../../../../src/extractor/extractNextEpisodeSchedule';
import { mockHtmlData } from '../../data/mocks';

describe('Extractors Comprehensive Suite', () => {
  describe('extractHomepage', () => {
    it('should extract spotlight items', () => {
      const result = extractHomepage(mockHtmlData.homepage);
      expect(result.spotlight).toHaveLength(1);
      expect(result.spotlight[0].title).toBe('Spotlight Anime');
    });
  });

  describe('extractDetailpage', () => {
    it('should extract detail info', () => {
      const result = extractDetailpage(mockHtmlData.detail);
      expect(result.title).toBe('Detail Anime');
      expect(result.is18Plus).toBe(true);
    });
  });

  describe('extractListPage', () => {
    it('should extract results from list page', () => {
      const result = extractListPage(mockHtmlData.search);
      expect(result.response).toHaveLength(1);
      expect(result.response[0].title).toBe('Search Result');
    });
  });

  describe('extractCharacters', () => {
    it('should extract characters', () => {
      const result = extractCharacters(mockHtmlData.characters);
      expect(result.response).toHaveLength(1);
      expect(result.response[0].name).toBe('Character Name');
    });
  });

  describe('extractNews', () => {
    it('should extract news items', () => {
      const result = extractNews(mockHtmlData.news);
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('News Title');
    });
  });

  describe('extractSchedule', () => {
    it('should extract schedule', () => {
      const result = extractSchedule(mockHtmlData.schedule);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Scheduled Anime');
    });
  });

  describe('extractEpisodes', () => {
    it('should extract episodes', () => {
      const result = extractEpisodes(mockHtmlData.episodes);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Episode 1');
    });
  });

  describe('extractCharacterDetail', () => {
    it('should extract character detail', () => {
      const result = extractCharacterDetail(mockHtmlData.characterDetail);
      expect(result.name).toBe('Character Full Name');
    });
  });

  describe('extractSuggestions', () => {
    it('should extract suggestions', () => {
      const result = extractSuggestions(mockHtmlData.suggestions);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('S1');
    });
  });

  describe('extractTopSearch', () => {
    it('should extract top search', () => {
      const result = extractTopSearch(mockHtmlData.topSearch);
      expect(result).toHaveLength(3);
      expect(result[2].title).toBe('Top Title');
    });
  });

  describe('extractNextEpisodeSchedule', () => {
    it('should extract next episode schedule', () => {
      const result = extractNextEpisodeSchedule(mockHtmlData.scheduleNext);
      expect(result).toBe('10:00');
    });
  });
});

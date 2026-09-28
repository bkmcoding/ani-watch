import { load } from 'cheerio';

export const extractNextEpisodeSchedule = (html: string): string | null => {
  const $ = load(html);

  // Try to get schedule from data-value attribute
  const scheduleElement = $('#schedule-date');
  const scheduleDate = scheduleElement.attr('data-value');

  if (scheduleDate) {
    return scheduleDate;
  }

  // Fallback: try to get from text content
  const rawString = $('.tick-item.tick-eps.schedule').text().trim();

  return rawString || null;
};

import { Context } from 'hono';
import config from '../config/config';
import { validationError } from '../utils/errors';
import { extractSchedule, ScheduledAnime } from '../extractor/extractSchedule';
import { axiosInstance } from '../services/axiosInstance';

export interface ScheduleResponse {
  success: boolean;
  data: {
    [date: string]: ScheduledAnime[];
  };
}

async function schedulesController(c: Context): Promise<ScheduleResponse> {
  const today = new Date();
  const dateParam = c.req.query('date');

  let startDate = today;
  if (dateParam) {
    const [year, month, day] = dateParam.split('-').map(Number);
    startDate = new Date(year, month - 1, day);
    if (isNaN(startDate.getTime())) {
      throw new validationError('Invalid date format. Use YYYY-MM-DD');
    }
  }

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  try {
    const promises = dates.map(async date => {
      const ajaxUrl = `/ajax/schedule/list?tzOffset=-330&date=${date}`;
      try {
        const result = await axiosInstance(ajaxUrl, {
          headers: { Referer: `${config.baseurl}/home` },
        });

        if (!result.success || !result.data) {
          throw new Error(result.message || 'Failed to fetch');
        }

        const jsonData = JSON.parse(result.data);
        return {
          date,
          shows: extractSchedule(jsonData.html),
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to fetch schedule for ${date}: ${errorMessage}`);
        return {
          date,
          shows: [] as ScheduledAnime[],
          error: 'Failed to fetch',
        };
      }
    });

    const results = await Promise.all(promises);

    // Format response to map dates to shows
    const response: { [date: string]: ScheduledAnime[] } = {};
    results.forEach(result => {
      response[result.date] = result.shows;
    });

    return {
      success: true,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(errorMessage);
    throw new validationError('Failed to fetch schedules');
  }
}

export default schedulesController;

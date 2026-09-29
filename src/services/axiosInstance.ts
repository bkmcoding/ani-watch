import config from '../config/config';
import { cached } from '../lib/ttlCache';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const TIMEOUT = 10000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type AxiosInstanceOptions = {
  headers?: Record<string, string>;
  retries?: number;
  /** Cache successful responses for this many ms (0 = no cache). */
  cacheTtlMs?: number;
};

const axiosInstance = async (
  endpoint: string,
  options: AxiosInstanceOptions = {}
) => {
  const { headers: customHeaders = {}, retries = MAX_RETRIES, cacheTtlMs = 0 } = options;
  const cacheKey = `axios:${endpoint}|${JSON.stringify(customHeaders)}`;

  const run = async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
          await sleep(delay);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(config.baseurl + endpoint, {
          headers: {
            ...(config.headers || {}),
            ...customHeaders,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN;
          // Retry-After can be a delay in seconds OR an HTTP-date string.
          // parseInt of a date string returns NaN — fall back to a safe default.
          const waitTime = Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : RETRY_DELAY * 2;
          await sleep(waitTime);
          continue;
        }

        // Retry only transient upstream failures
        if (response.status >= 500 && response.status < 600) {
          throw new Error(`Server error: HTTP ${response.status}`);
        }

        if (!response.ok) {
          // 4xx (except 429): do not retry
          return {
            success: false as const,
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        const data = await response.text();
        if (!data || data.length === 0) {
          throw new Error('Empty response received');
        }

        return {
          success: true as const,
          data,
        };
      } catch (error: unknown) {
        if (error instanceof Error) {
          lastError =
            error.name === 'AbortError'
              ? new Error('Request timeout - the external API took too long to respond')
              : error;
        }
        if (attempt === retries - 1) break;
      }
    }

    return {
      success: false as const,
      message: lastError?.message || 'Unknown error occurred',
    };
  };

  if (cacheTtlMs > 0) {
    return cached(cacheKey, cacheTtlMs, run);
  }
  return run();
};

export { axiosInstance };
export default axiosInstance;

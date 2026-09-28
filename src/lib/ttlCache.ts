type Entry<T> = { value: T; expires: number };

export type TtlCacheOptions = {
  max?: number;
};

/**
 * Tiny in-memory TTL cache with LRU eviction and inflight dedupe.
 * Good for warm Vercel instances / bursty bot traffic — not a global store.
 */
export function createTtlCache<T = unknown>(opts: TtlCacheOptions = {}) {
  const max = opts.max ?? 300;
  const store = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  function get(key: string): T | undefined {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      store.delete(key);
      return undefined;
    }
    store.delete(key);
    store.set(key, hit);
    return hit.value;
  }

  function set(key: string, value: T, ttlMs: number) {
    if (ttlMs <= 0) return;
    if (store.size >= max) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expires: Date.now() + ttlMs });
  }

  async function getOrSet(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    if (ttlMs <= 0) return loader();
    const cached = get(key);
    if (cached !== undefined) return cached;

    const pending = inflight.get(key);
    if (pending) return pending;

    const job = (async () => {
      const value = await loader();
      set(key, value, ttlMs);
      return value;
    })().finally(() => {
      inflight.delete(key);
    });

    inflight.set(key, job);
    return job;
  }

  return { get, set, getOrSet, size: () => store.size };
}

/** Shared process-wide cache for scrape / theme / stream metadata. */
export const scrapeCache = createTtlCache<unknown>({ max: 400 });

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  return scrapeCache.getOrSet(key, ttlMs, loader) as Promise<T>;
}

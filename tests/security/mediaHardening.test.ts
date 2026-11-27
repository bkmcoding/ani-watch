import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import worker from '../../workers/media-proxy/src/index';
import {
  fetchStreamWithRedirects,
  MAX_HLS_SEGMENT_BYTES,
  readBodyCapped,
  StreamResponseTooLargeError,
} from '../../src/lib/mediaProxyCore';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MEDIA_PROXY_SECRET;
});

function stubFetch(handler: (url: string) => Response): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      return handler(url);
    })
  );
  return calls;
}

describe('Subtitle proxy CDN allowlist', () => {
  it('rejects hosts outside the shared poster/subtitle allowlist before fetching', async () => {
    const calls = stubFetch(() => new Response('WEBVTT', { status: 200 }));

    const res = await app.request(
      '/api/v2/hianime/vtt?url=' + encodeURIComponent('https://subs.example.com/en.vtt')
    );

    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('fetches subtitles from an allowlisted CDN', async () => {
    const calls = stubFetch(
      () =>
        new Response('WEBVTT\n\n00:00.000 --> 00:01.000\nHi', {
          status: 200,
          headers: { 'content-type': 'text/vtt' },
        })
    );

    const res = await app.request(
      '/api/v2/hianime/vtt?url=' + encodeURIComponent('https://cdn.anipixcdn.co/en.vtt')
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/vtt');
    expect(await res.text()).toContain('WEBVTT');
    expect(calls).toEqual(['https://cdn.anipixcdn.co/en.vtt']);
  });

  it('serves SSA subtitle tracks as plain text', async () => {
    stubFetch(
      () =>
        new Response('[Script Info]\n', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
    );

    const res = await app.request(
      '/api/v2/hianime/vtt?url=' + encodeURIComponent('https://cdn.anipixcdn.co/eng.ssa')
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('re-validates redirect hops against the allowlist', async () => {
    const calls = stubFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://subs.example.com/en.vtt' },
        })
    );

    const res = await app.request(
      '/api/v2/hianime/vtt?url=' + encodeURIComponent('https://cdn.anipixcdn.co/en.vtt')
    );

    expect(res.status).toBe(502);
    expect(calls).toEqual(['https://cdn.anipixcdn.co/en.vtt']);
  });
});

describe('HLS upstream limits', () => {
  it('rejects an upstream segment whose declared size exceeds the byte cap', async () => {
    stubFetch(
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            'content-type': 'video/mp2t',
            'content-length': String(MAX_HLS_SEGMENT_BYTES + 1),
          },
        })
    );

    const res = await app.request(
      '/api/v2/hianime/hls?url=' + encodeURIComponent('https://cdn.example.com/seg.ts')
    );

    expect(res.status).toBe(502);
    expect(await res.text()).toContain('too large');
  });

  it('rejects a chunked body that grows past the cap', async () => {
    const response = new Response(new Uint8Array(11));
    await expect(readBodyCapped(response, 10)).rejects.toBeInstanceOf(StreamResponseTooLargeError);
  });

  it('rejects without reading when content-length already exceeds the cap', async () => {
    const response = new Response(new Uint8Array([1]), { headers: { 'content-length': '999' } });
    await expect(readBodyCapped(response, 10)).rejects.toBeInstanceOf(StreamResponseTooLargeError);
  });

  it('applies the configured upstream timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: string | URL, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('timeout', 'TimeoutError'))
            );
          })
      )
    );

    await expect(
      fetchStreamWithRedirects('https://cdn.example.com/a.m3u8', {}, { timeoutMs: 20 })
    ).rejects.toThrow();
  });
});

describe('Browse page secret exposure', () => {
  it('does not embed MEDIA_PROXY_SECRET in page source', async () => {
    process.env.MEDIA_PROXY_SECRET = 'super-secret-browse-value';

    const res = await app.request('/browse');
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).not.toContain('super-secret-browse-value');
    expect(html).not.toContain('POSTER_PROXY_KEY');
  });
});

describe('Cloudflare Worker media proxy parity', () => {
  it('enforces the subtitle allowlist', async () => {
    const calls = stubFetch(() => new Response('WEBVTT', { status: 200 }));

    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/vtt?url=' +
          encodeURIComponent('https://subs.example.com/en.vtt')
      ),
      {}
    );

    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('allows allowlisted subtitles', async () => {
    stubFetch(
      () => new Response('WEBVTT\n', { status: 200, headers: { 'content-type': 'text/vtt' } })
    );

    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/vtt?url=' +
          encodeURIComponent('https://cdn.anipixcdn.co/en.vtt')
      ),
      {}
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('WEBVTT');
  });

  it('caps /hls responses', async () => {
    stubFetch(
      () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: {
            'content-type': 'video/mp2t',
            'content-length': String(MAX_HLS_SEGMENT_BYTES + 1),
          },
        })
    );

    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/hls?url=' +
          encodeURIComponent('https://cdn.example.com/seg.ts')
      ),
      {}
    );

    expect(res.status).toBe(502);
    expect(await res.text()).toContain('too large');
  });

  it('keeps /poster open without k so the public browse page can use it', async () => {
    stubFetch(
      () =>
        new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })
    );

    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/poster?url=' +
          encodeURIComponent('https://cdn.anipixcdn.co/p.jpg')
      ),
      { MEDIA_PROXY_SECRET: 'secret' }
    );

    expect(res.status).toBe(200);
  });

  it('still requires k for /hls when a secret is configured', async () => {
    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/hls?url=' +
          encodeURIComponent('https://cdn.example.com/seg.ts')
      ),
      { MEDIA_PROXY_SECRET: 'secret' }
    );

    expect(res.status).toBe(401);
  });
});

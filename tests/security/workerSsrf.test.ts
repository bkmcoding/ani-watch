import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../workers/media-proxy/src/index';

afterEach(() => {
  vi.unstubAllGlobals();
});

function redirectTo(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

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

// Guard and redirect-loop behaviour is unit-tested against the shared
// mediaProxyCore implementation; these cover the Worker's wiring of it.
describe('Worker /hls production path', () => {
  it('blocks a metadata redirect end-to-end', async () => {
    const calls = stubFetch(() => redirectTo('https://169.254.169.254/latest/meta-data/'));

    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/hls?url=' +
          encodeURIComponent('https://cdn.example.com/master.m3u8')
      ),
      {}
    );

    expect(res.status).toBe(502);
    expect(await res.text()).toContain('redirect not allowed');
    expect(calls).toEqual(['https://cdn.example.com/master.m3u8']);
  });

  it('blocks a direct hex IPv4-mapped IPv6 target before any fetch', async () => {
    const calls = stubFetch(() => new Response('should not be fetched', { status: 200 }));

    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/hls?url=' +
          encodeURIComponent('https://[::ffff:a9fe:a9fe]/x.m3u8')
      ),
      {}
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toContain('host not allowed');
    expect(calls).toEqual([]);
  });

  it('proxies a redirected playlist and routes subtitles to /vtt', async () => {
    const calls = stubFetch(url =>
      url === 'https://cdn.example.com/master.m3u8'
        ? redirectTo('https://cdn2.example.com/media.m3u8')
        : new Response(
            [
              '#EXTM3U',
              '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",URI="subs"',
              'segment-1.ts',
            ].join('\n'),
            { status: 200, headers: { 'content-type': 'application/vnd.apple.mpegurl' } }
          )
    );

    const res = await worker.fetch(
      new Request(
        'https://media.example.workers.dev/hls?url=' +
          encodeURIComponent('https://cdn.example.com/master.m3u8')
      ),
      {}
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('https://media.example.workers.dev/vtt?url=');
    expect(body).toContain('https://media.example.workers.dev/hls?url=');
    expect(calls).toEqual([
      'https://cdn.example.com/master.m3u8',
      'https://cdn2.example.com/media.m3u8',
    ]);
  });
});

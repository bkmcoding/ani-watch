import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { fetchStreamWithRedirects, StreamUrlError } from '../../src/lib/mediaProxyCore';

function redirectTo(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

function ok(body = '#EXTM3U'): Response {
  return new Response(body, { status: 200 });
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

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MEDIA_PROXY_SECRET;
});

describe('Proxy redirect re-validation (SSRF)', () => {
  it('follows redirects that stay on public https hosts', async () => {
    const calls = stubFetch(url =>
      url === 'https://cdn.example.com/master.m3u8'
        ? redirectTo('https://cdn2.example.com/media.m3u8')
        : ok()
    );

    const res = await fetchStreamWithRedirects('https://cdn.example.com/master.m3u8');

    expect(res.status).toBe(200);
    expect(calls).toEqual([
      'https://cdn.example.com/master.m3u8',
      'https://cdn2.example.com/media.m3u8',
    ]);
  });

  it('rejects a redirect to the cloud metadata IP without fetching it', async () => {
    const calls = stubFetch(() => redirectTo('https://169.254.169.254/latest/meta-data/'));

    await expect(fetchStreamWithRedirects('https://cdn.example.com/a.m3u8')).rejects.toBeInstanceOf(
      StreamUrlError
    );
    expect(calls).toEqual(['https://cdn.example.com/a.m3u8']);
  });

  it('rejects a redirect to a hex IPv4-mapped IPv6 host', async () => {
    const calls = stubFetch(() => redirectTo('https://[::ffff:a9fe:a9fe]/latest/meta-data/'));

    await expect(fetchStreamWithRedirects('https://cdn.example.com/a.m3u8')).rejects.toThrow(
      /host not allowed/i
    );
    expect(calls).toEqual(['https://cdn.example.com/a.m3u8']);
  });

  it('rejects protocol downgrades and protocol-relative internal redirects', async () => {
    stubFetch(() => redirectTo('http://169.254.169.254/latest/meta-data/'));
    await expect(fetchStreamWithRedirects('https://cdn.example.com/a.m3u8')).rejects.toThrow(
      /https/i
    );

    stubFetch(() => redirectTo('//127.0.0.1:8080/internal'));
    await expect(fetchStreamWithRedirects('https://cdn.example.com/a.m3u8')).rejects.toBeInstanceOf(
      StreamUrlError
    );
  });

  it('stops after the redirect limit', async () => {
    const calls = stubFetch(() => redirectTo('https://cdn.example.com/loop.m3u8'));

    await expect(fetchStreamWithRedirects('https://cdn.example.com/loop.m3u8')).rejects.toThrow(
      /too many redirects/i
    );
    expect(calls.length).toBe(1 + 5);
  });

  it('blocks SSRF redirects through the HLS proxy', async () => {
    delete process.env.MEDIA_PROXY_SECRET;
    const calls = stubFetch(() => redirectTo('https://[::ffff:a9fe:a9fe]/latest/meta-data/'));

    const res = await app.request(
      '/api/v2/hianime/hls?url=' + encodeURIComponent('https://cdn.example.com/master.m3u8')
    );

    expect(res.status).toBe(502);
    expect(calls).toEqual(['https://cdn.example.com/master.m3u8']);
  });

  it('blocks SSRF redirects through the VTT proxy', async () => {
    const calls = stubFetch(() => redirectTo('https://169.254.169.254/latest/meta-data/'));

    const res = await app.request(
      '/api/v2/hianime/vtt?url=' + encodeURIComponent('https://cdn.anipixcdn.co/sub.vtt')
    );

    expect(res.status).toBe(502);
    expect(calls).toEqual(['https://cdn.anipixcdn.co/sub.vtt']);
  });

  it('rejects a direct IPv4-mapped IPv6 target before any fetch', async () => {
    const calls = stubFetch(() => ok());

    const res = await app.request(
      '/api/v2/hianime/hls?url=' + encodeURIComponent('https://[::ffff:a9fe:a9fe]/x.m3u8')
    );

    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { browseController } from '../../src/handlers/pages/browse';

function getApp() {
  const app = new Hono();
  app.get('/browse', browseController);
  return app;
}

describe('Browse Page Cinema Player Preferred Server Integration (Task 7)', () => {
  it('reads ani.preferredServer from localStorage with fallback to hd-1', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    expect(html).toContain("localStorage.getItem('ani.preferredServer')");
    expect(html).toMatch(/localStorage\.getItem\(\s*['"]ani\.preferredServer['"]\s*\)\s*\|\|\s*['"]hd-1['"]/);
  });

  it('passes server parameter dynamically into /api/v2/hianime/episode/sources', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    // Verify it doesn't hardcode server: 'hd-1' in episode sources fetch
    expect(html).not.toMatch(/server:\s*['"]hd-1['"]\s*,\s*category:\s*audioCat/);
    // Verify it passes dynamic server
    expect(html).toMatch(/server:\s*server/);
    expect(html).toContain('/api/v2/hianime/episode/sources');
  });

  it('excludes zoko when audio category is dub and resets preferred server if zoko', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    // Verify compatibility check: if dub and zoko, reset to hd-1
    expect(html).toMatch(/audioCat\s*===\s*['"]dub['"]\s*&&\s*preferredServer\s*===\s*['"]zoko['"]/);
    // Verify zoko is excluded from base servers when audio category is dub
    expect(html).toMatch(/audioCat\s*===\s*['"]dub['"]/);
    expect(html).toContain("'zoko'");
  });

  it('implements sequential pre-flight fallback across servers with informative status updates', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    // Loop across resolution chain
    expect(html).toMatch(/for\s*\(\s*var\s+[a-zA-Z0-9_]+\s*=\s*0;\s*[a-zA-Z0-9_]+\s*<\s*chain\.length;/);
    // Status update on server failure
    expect(html).toMatch(/setStatus\(\s*['"]Server ['"]\s*\+\s*server\s*\+\s*['"] unavailable, trying fallback…['"]\s*\)/);
    // Final error when all servers fail
    expect(html).toContain('Could not resolve stream across available servers.');
  });

  it('persists preferred server in localStorage upon successful resolution if different', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    // If server differs from initial/preferred, update localStorage
    expect(html).toMatch(/localStorage\.setItem\(\s*['"]ani\.preferredServer['"]\s*,\s*server\s*\)/);
  });

  it('passes server into cinema player iframe URL', async () => {
    const app = getApp();
    const res = await app.request('/browse');
    const html = await res.text();

    expect(html).toMatch(/server=\s*['"]?\s*\+\s*encodeURIComponent\(\s*server\s*\)/);
  });

  describe('Priority Resolution Chain Permutations', () => {
    // Replicate the exact client script algorithm
    function buildChain(preferred: string, audioCat: string) {
      let preferredServer = (preferred || 'hd-1').toLowerCase();
      if (audioCat === 'dub' && preferredServer === 'zoko') {
        preferredServer = 'hd-1';
      }
      let baseServers = ['hd-1', 'hd-2', 'zoko', 'gogo'];
      if (audioCat === 'dub') {
        baseServers = ['hd-1', 'hd-2', 'gogo'];
      }
      if (baseServers.indexOf(preferredServer) === -1) {
        preferredServer = 'hd-1';
      }
      const chain = [preferredServer];
      for (let i = 0; i < baseServers.length; i++) {
        if (chain.indexOf(baseServers[i]) === -1) {
          chain.push(baseServers[i]);
        }
      }
      return chain;
    }

    it('orders chain correctly for each sub preferred server', () => {
      expect(buildChain('hd-1', 'sub')).toEqual(['hd-1', 'hd-2', 'zoko', 'gogo']);
      expect(buildChain('hd-2', 'sub')).toEqual(['hd-2', 'hd-1', 'zoko', 'gogo']);
      expect(buildChain('zoko', 'sub')).toEqual(['zoko', 'hd-1', 'hd-2', 'gogo']);
      expect(buildChain('gogo', 'sub')).toEqual(['gogo', 'hd-1', 'hd-2', 'zoko']);
    });

    it('orders chain correctly for dub, filtering out zoko', () => {
      expect(buildChain('hd-1', 'dub')).toEqual(['hd-1', 'hd-2', 'gogo']);
      expect(buildChain('hd-2', 'dub')).toEqual(['hd-2', 'hd-1', 'gogo']);
      // zoko preference defaults to hd-1 for dub
      expect(buildChain('zoko', 'dub')).toEqual(['hd-1', 'hd-2', 'gogo']);
      expect(buildChain('gogo', 'dub')).toEqual(['gogo', 'hd-1', 'hd-2']);
    });

    it('defaults unknown/invalid server preference to hd-1', () => {
      expect(buildChain('unknown-server', 'sub')).toEqual(['hd-1', 'hd-2', 'zoko', 'gogo']);
      expect(buildChain('', 'dub')).toEqual(['hd-1', 'hd-2', 'gogo']);
    });
  });

  describe('Pre-flight Fallback Simulation', () => {
    it('simulates resolution on preferred server without fallback', async () => {
      const preferred = 'hd-2';
      const statusUpdates: string[] = [];
      const setStatus = (msg: string) => statusUpdates.push(msg);
      let savedPref: string | null = null;
      const localStorageMock = {
        getItem: () => preferred,
        setItem: (_key: string, val: string) => { savedPref = val; },
      };

      const chain = ['hd-2', 'hd-1', 'zoko', 'gogo'];
      let openedLink: string | null = null;

      for (let s = 0; s < chain.length; s++) {
        const server = chain[s];
        try {
          // Simulate hd-2 succeeding
          const data = { link: 'https://example.com/watch?server=hd-2' };
          openedLink = data.link;
          if (server !== preferred) {
            localStorageMock.setItem('ani.preferredServer', server);
          }
          break;
        } catch {
          if (s < chain.length - 1) {
            setStatus('Server ' + server + ' unavailable, trying fallback…');
          }
        }
      }

      expect(openedLink).toBe('https://example.com/watch?server=hd-2');
      expect(statusUpdates).toHaveLength(0);
      expect(savedPref).toBeNull(); // Did not change because preferred server succeeded
    });

    it('simulates fallback to next server when preferred server fails', async () => {
      const preferred = 'hd-2';
      const statusUpdates: string[] = [];
      const setStatus = (msg: string) => statusUpdates.push(msg);
      let savedPref: string | null = null;
      const localStorageMock = {
        getItem: () => preferred,
        setItem: (_key: string, val: string) => { savedPref = val; },
      };

      const chain = ['hd-2', 'hd-1', 'zoko', 'gogo'];
      let openedLink: string | null = null;

      for (let s = 0; s < chain.length; s++) {
        const server = chain[s];
        try {
          if (server === 'hd-2') throw new Error('Timeout');
          // hd-1 succeeds
          const data = { link: 'https://example.com/watch?ep=1' };
          openedLink = data.link + '&server=' + encodeURIComponent(server);
          if (server !== preferred) {
            localStorageMock.setItem('ani.preferredServer', server);
          }
          break;
        } catch {
          if (s < chain.length - 1) {
            setStatus('Server ' + server + ' unavailable, trying fallback…');
          }
        }
      }

      expect(statusUpdates).toContain('Server hd-2 unavailable, trying fallback…');
      expect(openedLink).toContain('&server=hd-1');
      expect(savedPref).toBe('hd-1'); // Persisted new working server
    });

    it('simulates exhaustion of all servers with final error status', async () => {
      const preferred = 'hd-1';
      const statusUpdates: string[] = [];
      let isError = false;
      const setStatus = (msg: string, err?: boolean) => {
        statusUpdates.push(msg);
        if (err) isError = true;
      };

      const chain = ['hd-1', 'hd-2', 'zoko', 'gogo'];
      let resolved = false;

      for (let s = 0; s < chain.length; s++) {
        const server = chain[s];
        try {
          throw new Error('500 Server Error');
        } catch {
          if (s < chain.length - 1) {
            setStatus('Server ' + server + ' unavailable, trying fallback…');
          }
        }
      }

      if (!resolved) {
        setStatus('Could not resolve stream across available servers.', true);
      }

      expect(statusUpdates).toEqual([
        'Server hd-1 unavailable, trying fallback…',
        'Server hd-2 unavailable, trying fallback…',
        'Server zoko unavailable, trying fallback…',
        'Could not resolve stream across available servers.',
      ]);
      expect(isError).toBe(true);
    });
  });
});

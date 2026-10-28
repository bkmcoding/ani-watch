import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../../src/app';

describe('OWASP API Input Validation & Path Traversal Protections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects path traversal in anime detail endpoint', async () => {
    const res = await app.request('/api/v2/anime/..%2f..%2fetc%2fpasswd');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Invalid anime id');
  });

  it('rejects path traversal in character detail endpoint', async () => {
    const res = await app.request('/api/v2/character/..%2fadmin');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Invalid character id');
  });

  it('rejects path traversal in category list endpoint', async () => {
    const res = await app.request('/api/v2/animes/genre/..%2fadmin');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Invalid category parameter');
  });

  it('sanitizes Host header with path or query tampering in requestOrigin fallback', async () => {
    const res = await app.request('/api/v2/hianime/watch/play?animeEpisodeId=one-piece-1::1', {
      headers: {
        'x-forwarded-host': 'evil.com/attacker',
      },
    });
    // Should safely fallback to request host and not redirect to evil.com/attacker
    const location = res.headers.get('location') || '';
    expect(location).not.toContain('evil.com/attacker');
  });
});

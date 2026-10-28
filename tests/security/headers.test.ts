import { describe, expect, it } from 'vitest';
import app from '../../src/app';

describe('HTTP Security Headers & Middleware Hardening', () => {
  it('includes standard security headers on API JSON responses', async () => {
    const res = await app.request('/api');
    expect(res.status).toBe(200);

    const headers = res.headers;
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('includes Content-Security-Policy on HTML routes', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);

    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://cdn.jsdelivr.net');
    expect(csp).toContain('https://fonts.googleapis.com');
  });

  it('includes rate limit headers on /api/v2 routes', async () => {
    const res = await app.request('/api/v2/filter/options');
    expect(res.status).toBe(200);

    const headers = res.headers;
    expect(headers.get('x-ratelimit-limit')).toBeTruthy();
    expect(headers.get('x-ratelimit-remaining')).toBeTruthy();
    expect(headers.get('x-ratelimit-reset')).toBeTruthy();
  });

  it('rejects SSRF attempts on /api/v2/hianime/vtt with validation error', async () => {
    const res = await app.request('/api/v2/hianime/vtt?url=https://127.0.0.1/sub.vtt');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('permitted hosts');
  });

  it('rejects SSRF attempts on /api/v2/hianime/hls with validation error', async () => {
    const res = await app.request(
      '/api/v2/hianime/hls?url=https://169.254.169.254/latest/meta-data/'
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('host not allowed');
  });
});

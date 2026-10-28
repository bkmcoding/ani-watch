import { describe, expect, it } from 'vitest';
import app from '../../src/app';

describe('API Key Authentication Guard', () => {
  it('allows access to JSON endpoints when BOT_SECRET_KEY is unset', async () => {
    delete process.env.BOT_SECRET_KEY;
    const res = await app.request('/api/v2/filter/options');
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated requests to JSON endpoints when BOT_SECRET_KEY is set', async () => {
    process.env.BOT_SECRET_KEY = 'super-secret-bot-key';
    try {
      const res = await app.request('/api/v2/filter/options');
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('Unauthorized');
    } finally {
      delete process.env.BOT_SECRET_KEY;
    }
  });

  it('accepts valid x-api-key header when BOT_SECRET_KEY is set', async () => {
    process.env.BOT_SECRET_KEY = 'super-secret-bot-key';
    try {
      const res = await app.request('/api/v2/filter/options', {
        headers: { 'x-api-key': 'super-secret-bot-key' },
      });
      expect(res.status).toBe(200);
    } finally {
      delete process.env.BOT_SECRET_KEY;
    }
  });

  it('accepts valid Bearer token authorization when BOT_SECRET_KEY is set', async () => {
    process.env.BOT_SECRET_KEY = 'super-secret-bot-key';
    try {
      const res = await app.request('/api/v2/filter/options', {
        headers: { authorization: 'Bearer super-secret-bot-key' },
      });
      expect(res.status).toBe(200);
    } finally {
      delete process.env.BOT_SECRET_KEY;
    }
  });

  it('keeps watch and media endpoints publicly accessible even when BOT_SECRET_KEY is set', async () => {
    process.env.BOT_SECRET_KEY = 'super-secret-bot-key';
    try {
      // /api/v2/hianime/watch returns 400 when missing query parameters, but NOT 401
      const res = await app.request('/api/v2/hianime/watch');
      expect(res.status).not.toBe(401);
    } finally {
      delete process.env.BOT_SECRET_KEY;
    }
  });
});

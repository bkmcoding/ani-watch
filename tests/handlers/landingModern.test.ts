import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { landingController } from '../../src/handlers/pages/landing';

describe('Landing Page Hero Search & Continue Watching', () => {
  it('renders direct search form routing to /browse', async () => {
    const app = new Hono();
    app.get('/', landingController);
    const res = await app.request('/');
    const html = await res.text();
    expect(html).toContain('<form class="hero-search" action="/browse" method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Search anime');
  });

  it('contains continue watching client script reading ani.cw from localStorage', async () => {
    const app = new Hono();
    app.get('/', landingController);
    const res = await app.request('/');
    const html = await res.text();
    expect(html).toContain("localStorage.getItem('ani.cw')");
    expect(html).toContain('id="resumeSection"');
    expect(html).toContain('Resume');
  });

  it('enforces 16px font-size on search input for mobile devices', async () => {
    const app = new Hono();
    app.get('/', landingController);
    const res = await app.request('/');
    const html = await res.text();
    expect(html).toContain('font-size: 16px');
  });
});

import { describe, expect, it } from 'vitest';
import app from '../../src/app';

describe('XSS & Input Sanitization Defenses', () => {
  it('escapes script-breaking sequences in watch template interpolations (safeJson)', async () => {
    const maliciousTitle = '</script><script>alert("xss")</script>';
    const url = `/api/v2/hianime/watch?sub=https://megacloud.blog/embed-2/e-1/hls.m3u8&title=${encodeURIComponent(
      maliciousTitle
    )}`;

    const res = await app.request(url);
    expect(res.status).toBe(200);

    const html = await res.text();
    // Must NOT contain unescaped closing script tag
    expect(html).not.toContain('</script><script>alert("xss")</script>');
    // Must contain safe unicode-escaped equivalent
    expect(html).toContain('\\u003c/script\\u003e');
  });

  it('rejects plain http stream URLs to prevent mixed content and insecure protocols', async () => {
    const res = await app.request('/api/v2/hianime/watch?sub=http://megacloud.blog/embed-2/e-1/hls.m3u8');
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('Episode unavailable');
  });

  it('includes Subresource Integrity (SRI) on external Hls.js script tag', async () => {
    const res = await app.request('/api/v2/hianime/watch?sub=https://megacloud.blog/embed-2/e-1/hls.m3u8');
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('integrity="sha384-');
    expect(html).toContain('crossorigin="anonymous"');
  });

  it('escapes single and double quotes in watch titles and subtitles', async () => {
    const titleWithQuotes = `Attack on Titan's "Special" & <Final>`;
    const url = `/api/v2/hianime/watch?sub=https://megacloud.blog/embed-2/e-1/hls.m3u8&title=${encodeURIComponent(
      titleWithQuotes
    )}`;

    const res = await app.request(url);
    expect(res.status).toBe(200);

    const html = await res.text();
    // Attribute or title should not have unescaped angle brackets or raw quotes breaking attributes
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });
});

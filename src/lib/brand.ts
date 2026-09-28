/** Site branding shared by JSON root, favicon, and watch player. */
export const SITE_NAME = 'ani.watch';
export const SITE_TAGLINE = 'by wab';
export const SITE_COLOR = '#3dd6c6';

/** Simple teal mark — works as favicon.svg / image/svg+xml.
 *  Keep docs/logo.svg in sync for the GitHub README hero. */
export const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${SITE_NAME}">
  <rect width="64" height="64" rx="14" fill="#0a0c10"/>
  <text x="32" y="42" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#e8edf5">a</text>
  <circle cx="46" cy="40" r="4.5" fill="${SITE_COLOR}"/>
</svg>`;

export function faviconResponse(): Response {
  return new Response(FAVICON_SVG, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/** Best-effort display title from a slug like `one-piece-100`. */
export function titleFromAnimeSlug(slug: string | null | undefined): string {
  if (!slug) return SITE_NAME;
  const parts = slug.split('-').filter(Boolean);
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return SITE_NAME;
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function faviconLinkTags(origin: string): string {
  const href = `${origin.replace(/\/+$/, '')}/favicon.svg`;
  return [
    `<link rel="icon" href="${href}" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="${href}" />`,
    `<meta name="theme-color" content="${SITE_COLOR}" />`,
    `<meta name="application-name" content="${SITE_NAME}" />`,
  ].join('\n  ');
}

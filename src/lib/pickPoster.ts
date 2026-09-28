/** Prefer lazy-load data-src, fall back to src; skip placeholders. */
export function pickPosterUrl(
  ...candidates: Array<string | undefined | null>
): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const s = String(raw).trim();
    if (!s) continue;
    if (s.startsWith('data:')) continue;
    if (/placeholder|loading\.gif|no_poster|default\.jpg/i.test(s)) continue;
    if (s.startsWith('//')) return `https:${s}`;
    return s;
  }
  return null;
}

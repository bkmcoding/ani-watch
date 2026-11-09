import {
  isHd1Server,
  isHd2Server,
  parseThemeServers,
  pickServer,
  resolveMegaPlaySources,
  ThemeServer,
} from './megaplay';
import { resolveZokoSources } from './zoko';
import { resolveGogoSources } from './gogoanime';
import { extractEpisodes } from '../extractors/extractEpisodes';
import {
  animeNumericId,
  animeSlugFromEpisodeId,
  episodeNumericId,
  fetchTheme,
  htmlFromAjax,
} from '../lib/themeAjax';
import {
  pickEnglishSubtitle,
  proxiedHlsUrl,
  proxiedVttUrl,
  watchPageUrl,
  watchPlayUrl,
} from '../lib/streamUrls';
import { titleFromAnimeSlug } from '../lib/brand';
import { scrapeCache } from '../lib/ttlCache';

const STREAM_TTL_MS = 180_000; // 3 minutes

export type ProviderId = 'megaplay' | 'zoko' | 'gogoanime';

export type AvailableProvider = {
  id: ProviderId;
  label: string;
  preferred: boolean;
  categories: Array<'sub' | 'dub'>;
  capabilities: {
    introOutro: boolean;
    softsubs: boolean;
  };
};

export type ResolvedTrack = {
  category: 'sub' | 'dub';
  provider: ProviderId;
  server: string;
  m3u8: string;
  stream: Awaited<ReturnType<typeof resolveMegaPlaySources>>;
};

const PROVIDER_META: Record<
  ProviderId,
  {
    label: string;
    preferred: boolean;
    capabilities: { introOutro: boolean; softsubs: boolean };
  }
> = {
  megaplay: {
    label: 'MegaPlay',
    preferred: true,
    capabilities: { introOutro: true, softsubs: true },
  },
  zoko: {
    label: 'Zoko',
    preferred: false,
    capabilities: { introOutro: false, softsubs: true },
  },
  gogoanime: {
    label: 'GogoAnime',
    preferred: false,
    capabilities: { introOutro: false, softsubs: false },
  },
};

function isMegaServer(s: ThemeServer): boolean {
  return (
    /(?:megaplay|megacloud|rapid-?cloud|vidcloud|vidstreaming)/i.test(s.embedUrl) ||
    /hd-?[12]/i.test(s.serverName) ||
    isHd1Server(s) ||
    isHd2Server(s)
  );
}

function pickZoko(servers: ThemeServer[], category: string) {
  const pool = servers.filter(
    s => s.type === category && (/zoko/i.test(s.embedUrl) || /zoko/i.test(s.serverName))
  );
  return pool[0] || null;
}

export function serverLabel(server: string): string {
  const norm = (server || '').toLowerCase().trim();
  if (/^(hd-?1|megacloud|vidstreaming)$/i.test(norm)) return 'HD-1';
  if (/^(hd-?2|rapidcloud|vidcloud)$/i.test(norm)) return 'HD-2';
  if (/^zoko$/i.test(norm)) return 'Zoko';
  if (/^(gogo|gogoanime|anitaku)$/i.test(norm)) return 'GogoAnime';
  return server ? server.toUpperCase() : 'Unknown';
}

export function providerLabel(id: string | null | undefined): string {
  if (id === 'megaplay') return PROVIDER_META.megaplay.label;
  if (id === 'zoko') return PROVIDER_META.zoko.label;
  if (id === 'gogoanime') return PROVIDER_META.gogoanime.label;
  return id || 'Unknown';
}

function detectProvider(embedUrl: string): ProviderId | null {
  if (/(?:megaplay|megacloud)/i.test(embedUrl)) return 'megaplay';
  if (/zoko/i.test(embedUrl)) return 'zoko';
  if (/gogo/i.test(embedUrl) || /anitaku/i.test(embedUrl)) return 'gogoanime';
  return null;
}

type StreamStep = 'hd-1' | 'hd-2' | 'zoko' | 'gogo';

function getFallbackChain(server: string): StreamStep[] {
  const norm = (server || '').toLowerCase().trim();
  if (norm === 'hd-2' || /^(hd[\s-]*2|rapid[\s-]*cloud|vid[\s-]*cloud)$/i.test(norm)) {
    return ['hd-2', 'hd-1', 'zoko', 'gogo'];
  }
  if (norm === 'zoko' || /zoko/i.test(norm)) {
    return ['zoko', 'hd-1', 'hd-2', 'gogo'];
  }
  if (norm === 'gogo' || /^(gogo|gogoanime|anitaku)$/i.test(norm)) {
    return ['gogo', 'hd-1', 'hd-2', 'zoko'];
  }
  return ['hd-1', 'hd-2', 'zoko', 'gogo'];
}

export async function resolveCategory(
  servers: ThemeServer[],
  category: 'sub' | 'dub',
  server: string,
  episodeId: string,
  animeTitle?: string | null
): Promise<ResolvedTrack | null> {
  const normServer = (server || 'hd-1').toLowerCase().trim();
  const cacheKey = `stream:${episodeId}:${category}:${normServer}`;
  const hit = scrapeCache.get(cacheKey) as ResolvedTrack | undefined;
  if (hit) return hit;

  const tryMegaPlayHd1 = async (): Promise<ResolvedTrack | null> => {
    const mega = pickServer(servers, 'hd-1', category);
    if (!mega || !isMegaServer(mega)) return null;
    if (isHd2Server(mega) && !isHd1Server(mega)) return null;
    const stream = await resolveMegaPlaySources(mega.embedUrl);
    const m3u8 = stream.sources[0]?.url;
    if (!m3u8) return null;
    return {
      category,
      provider: 'megaplay' as const,
      server: isHd1Server(mega) ? 'hd-1' : mega.serverName.toLowerCase().replace(/\s+/g, '-'),
      m3u8,
      stream,
    };
  };

  const tryMegaPlayHd2 = async (): Promise<ResolvedTrack | null> => {
    const mega = pickServer(servers, 'hd-2', category);
    if (!mega || !isMegaServer(mega)) return null;
    if (isHd1Server(mega) && !isHd2Server(mega)) return null;
    const stream = await resolveMegaPlaySources(mega.embedUrl);
    const m3u8 = stream.sources[0]?.url;
    if (!m3u8) return null;
    return {
      category,
      provider: 'megaplay' as const,
      server: isHd2Server(mega) ? 'hd-2' : mega.serverName.toLowerCase().replace(/\s+/g, '-'),
      m3u8,
      stream,
    };
  };

  const tryZoko = async (): Promise<ResolvedTrack | null> => {
    const zoko = pickZoko(servers, category);
    if (!zoko) return null;
    const stream = await resolveZokoSources(zoko.embedUrl);
    const m3u8 = stream.sources[0]?.url;
    if (!m3u8) return null;
    return {
      category,
      provider: 'zoko' as const,
      server: 'zoko',
      m3u8,
      stream: stream as unknown as Awaited<ReturnType<typeof resolveMegaPlaySources>>,
    };
  };

  const tryGogo = async (): Promise<ResolvedTrack | null> => {
    let epNum: string | number = '';
    try {
      epNum = episodeNumericId(episodeId);
    } catch {
      const match = episodeId.match(/(\d+)(?!.*\d)/);
      epNum = match ? match[1] : '1';
    }
    const slug = animeSlugFromEpisodeId(episodeId);
    const targetTitle = animeTitle || slug || '';
    if (!targetTitle) return null;

    const stream = await resolveGogoSources(targetTitle, epNum);
    if (!stream) return null;
    const m3u8 = stream.sources[0]?.url;
    if (!m3u8) return null;

    return {
      category,
      provider: 'gogoanime' as const,
      server: 'gogo',
      m3u8,
      stream: stream as unknown as Awaited<ReturnType<typeof resolveMegaPlaySources>>,
    };
  };

  const chain = getFallbackChain(normServer);
  const resolvers: Record<StreamStep, () => Promise<ResolvedTrack | null>> = {
    'hd-1': tryMegaPlayHd1,
    'hd-2': tryMegaPlayHd2,
    zoko: tryZoko,
    gogo: tryGogo,
  };

  let resolved: ResolvedTrack | null = null;
  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    const fn = resolvers[step];
    try {
      resolved = await fn();
      if (resolved) {
        if (i > 0) {
          console.info(
            `[Stream Resolver] Auto-failover to ${step} succeeded for ${episodeId} (${category}).`
          );
        }
        break;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const nextStep = chain[i + 1];
      if (nextStep) {
        console.warn(
          `[Stream Resolver] ${step} failed for ${episodeId} (${category}): ${msg}. Auto-failing over to ${nextStep}...`
        );
      } else {
        console.warn(
          `[Stream Resolver] ${step} failed for ${episodeId} (${category}): ${msg}. No more fallbacks available.`
        );
      }
    }
  }

  if (resolved) {
    scrapeCache.set(cacheKey, resolved, STREAM_TTL_MS);
  }

  return resolved;
}

function normalizeEpisodeId(raw: string): string {
  return raw.includes('::') ? raw.replace('::', '?') : raw;
}

async function findNeighbors(slug: string, currentEpNum: string) {
  try {
    const idNum = animeNumericId(slug);
    // fetchTheme is already TTL-cached
    const list = await fetchTheme(`episode/list/${idNum}`, `/watch/${slug}`);
    if (!list.success || !list.data) return null;
    const episodes = extractEpisodes(htmlFromAjax(list.data));
    const idx = episodes.findIndex(
      ep =>
        String(ep.episodeNumber) === String(currentEpNum) ||
        (ep.id && episodeNumericId(normalizeEpisodeId(ep.id)) === String(currentEpNum))
    );
    if (idx < 0) return null;
    const current = episodes[idx];
    const prev = idx > 0 ? episodes[idx - 1] : null;
    const next = idx < episodes.length - 1 ? episodes[idx + 1] : null;
    return {
      current,
      prev,
      next,
      total: episodes.length,
      index: idx + 1,
    };
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, ms);
    promise
      .then(v => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(v);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      });
  });
}

export type EpisodePlayback = {
  link: string;
  tracks: Record<string, unknown>;
  availableCategories: Array<'sub' | 'dub'>;
  availableProviders: AvailableProvider[];
  sources: Array<Record<string, unknown>>;
  headers: Record<string, string>;
  server: string;
  serverLabel: string;
  category: string;
  provider: string;
  providerLabel: string;
  animeId: string | null;
  animeTitle: string;
  episodeId: string;
  episodeNumber: number | null;
  episodeTitle: string | null;
  navigation: {
    prev: string | null;
    next: string | null;
    index: number | null;
    total: number | null;
  };
  subtitles?: unknown;
  intro?: unknown;
  outro?: unknown;
  anilistID?: unknown;
  malID?: unknown;
};

/** Providers listed on the theme server panel (not necessarily resolved yet). */
export function buildAvailableProviders(
  servers: ThemeServer[],
  categories: Array<'sub' | 'dub'>
): AvailableProvider[] {
  const byId = new Map<ProviderId, { categories: Set<'sub' | 'dub'> }>();

  for (const s of servers) {
    const cat = s.type === 'dub' ? 'dub' : s.type === 'sub' ? 'sub' : null;
    if (!cat || !categories.includes(cat)) continue;
    const id = detectProvider(s.embedUrl);
    if (!id) continue;
    const entry = byId.get(id) || { categories: new Set() };
    entry.categories.add(cat);
    byId.set(id, entry);
  }

  // GogoAnime fallback resilience provider: available across active categories
  if (categories.length > 0) {
    const gogoEntry = byId.get('gogoanime') || { categories: new Set() };
    for (const cat of categories) {
      gogoEntry.categories.add(cat);
    }
    byId.set('gogoanime', gogoEntry);
  }

  const order: ProviderId[] = ['megaplay', 'zoko', 'gogoanime'];
  return order
    .filter(id => byId.has(id))
    .map(id => {
      const meta = PROVIDER_META[id];
      return {
        id,
        label: meta.label,
        preferred: meta.preferred,
        categories: Array.from(byId.get(id)!.categories),
        capabilities: { ...meta.capabilities },
      };
    });
}

/** Resolve MegaPlay/Zoko/Gogo streams + watch link (+ prev/next play URLs). */
export async function resolveEpisodePlayback(
  origin: string,
  animeEpisodeId: string,
  opts?: { server?: string; category?: string; nav?: boolean }
): Promise<EpisodePlayback> {
  const server = (opts?.server || 'hd-1').toLowerCase();
  const preferred = ((opts?.category || 'sub').toLowerCase() === 'dub' ? 'dub' : 'sub') as
    'sub' | 'dub';
  const other = (preferred === 'sub' ? 'dub' : 'sub') as 'sub' | 'dub';
  const episodeId = normalizeEpisodeId(animeEpisodeId);
  const epNum = episodeNumericId(episodeId);
  const slug = animeSlugFromEpisodeId(episodeId);
  const referer = slug ? `/watch/${slug}?ep=${epNum}` : `/`;
  const wantNav = opts?.nav !== false;
  const animeTitle = titleFromAnimeSlug(slug);

  const result = await fetchTheme(`episode/servers?episodeId=${epNum}`, referer);
  if (!result.success || !result.data) {
    throw new Error(result.message || 'could not load episode servers');
  }

  const servers = parseThemeServers(htmlFromAjax(result.data));
  const hasPreferred = servers.some(s => s.type === preferred) || server === 'gogo';
  const hasOther = servers.some(s => s.type === other);

  const neighborsPromise = wantNav && slug ? findNeighbors(slug, epNum) : Promise.resolve(null);

  // Resolve the primary (requested) track first — sequential to avoid hitting
  // the upstream embed server with two parallel requests (causes rate-limiting).
  const OTHER_CATEGORY_BUDGET_MS = 3_500;

  const primary = hasPreferred
    ? await resolveCategory(servers, preferred, server, episodeId, animeTitle)
    : null;

  // Best-effort secondary track + neighbors in parallel with a short budget.
  const [secondary, neighbors] = await Promise.all([
    hasOther
      ? withTimeout(
          resolveCategory(servers, other, server, episodeId, animeTitle),
          OTHER_CATEGORY_BUDGET_MS
        )
      : Promise.resolve(null),
    withTimeout(neighborsPromise, OTHER_CATEGORY_BUDGET_MS),
  ]);

  const subTrack = preferred === 'sub' ? primary : secondary;
  const dubTrack = preferred === 'dub' ? primary : secondary;

  if (!subTrack && !dubTrack) {
    throw new Error('No playable sub/dub stream found for this episode');
  }

  const active = primary || subTrack || dubTrack;
  if (!active) {
    throw new Error(`No ${preferred} stream available`);
  }

  const subCc = pickEnglishSubtitle(subTrack?.stream.subtitles);
  const dubCc = pickEnglishSubtitle(dubTrack?.stream.subtitles);
  const episodeTitle = neighbors?.current?.title || null;
  const episodeNumber = neighbors?.current?.episodeNumber ?? (Number(epNum) || null);

  const prevId = neighbors?.prev?.id ? normalizeEpisodeId(neighbors.prev.id) : null;
  const nextId = neighbors?.next?.id ? normalizeEpisodeId(neighbors.next.id) : null;

  const watchOpts = {
    sub: subTrack?.m3u8 || null,
    dub: dubTrack?.m3u8 || null,
    subCc,
    dubCc,
    animeId: slug,
    animeTitle,
    episodeId,
    episodeNumber,
    episodeTitle,
    prevEpisodeId: prevId,
    nextEpisodeId: nextId,
    epIndex: neighbors?.index ?? null,
    epTotal: neighbors?.total ?? null,
    // is/ie/os/oe = sub when present, else active (dub-only)
    intro: subTrack?.stream.intro ?? (!subTrack ? dubTrack?.stream.intro : null) ?? null,
    outro: subTrack?.stream.outro ?? (!subTrack ? dubTrack?.stream.outro : null) ?? null,
    // dis/die/dos/doe only when both tracks exist
    dubIntro: subTrack && dubTrack ? (dubTrack.stream.intro ?? null) : null,
    dubOutro: subTrack && dubTrack ? (dubTrack.stream.outro ?? null) : null,
    subProvider: subTrack?.provider ?? null,
    dubProvider: dubTrack?.provider ?? null,
  };

  const availableCategories: Array<'sub' | 'dub'> = [
    ...(subTrack ? (['sub'] as const) : []),
    ...(dubTrack ? (['dub'] as const) : []),
  ];
  const availableProviders = buildAvailableProviders(servers, availableCategories);

  const link = watchPageUrl(origin, {
    ...watchOpts,
    category: active.category,
    provider: active.provider,
  });

  const tracks: Record<string, unknown> = {};
  for (const track of [subTrack, dubTrack]) {
    if (!track) continue;
    const enCc = pickEnglishSubtitle(track.stream.subtitles);
    const caps = PROVIDER_META[track.provider].capabilities;
    tracks[track.category] = {
      link: watchPageUrl(origin, {
        ...watchOpts,
        category: track.category,
        provider: track.provider,
      }),
      streamUrl: proxiedHlsUrl(origin, track.m3u8),
      originalUrl: track.m3u8,
      server: track.server,
      serverLabel: serverLabel(track.server),
      provider: track.provider,
      providerLabel: providerLabel(track.provider),
      capabilities: {
        introOutro: caps.introOutro,
        softsubs: caps.softsubs,
        hasIntro: Boolean(track.stream.intro),
        hasOutro: Boolean(track.stream.outro),
        hasEnglishCc: Boolean(enCc),
      },
      subtitles: track.stream.subtitles,
      intro: track.stream.intro ?? null,
      outro: track.stream.outro ?? null,
      englishCc: enCc
        ? {
            url: proxiedVttUrl(origin, enCc),
            originalUrl: enCc,
          }
        : null,
    };
  }

  return {
    ...active.stream,
    link,
    tracks,
    availableCategories,
    availableProviders,
    sources: [
      {
        url: link,
        isM3U8: false,
        quality: 'auto',
        type: 'link' as const,
        streamUrl: proxiedHlsUrl(origin, active.m3u8),
        originalUrl: active.m3u8,
      },
    ],
    headers: {
      Referer: `${origin}/`,
      'User-Agent': active.stream.headers['User-Agent'] || '',
    },
    server: active.server,
    serverLabel: serverLabel(active.server),
    category: active.category,
    provider: active.provider,
    providerLabel: providerLabel(active.provider),
    animeId: slug,
    animeTitle,
    episodeId,
    episodeNumber,
    episodeTitle,
    navigation: {
      prev: prevId ? watchPlayUrl(origin, prevId, active.category) : null,
      next: nextId ? watchPlayUrl(origin, nextId, active.category) : null,
      index: neighbors?.index ?? null,
      total: neighbors?.total ?? null,
    },
  };
}

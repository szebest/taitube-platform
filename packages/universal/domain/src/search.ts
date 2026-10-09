import { MS_PER_DAY, SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@vp/domain/time';

export const SEARCH_TYPES = ['all', 'video', 'channel', 'playlist'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchResultKind = Exclude<SearchType, 'all'>;

export const SEARCH_SORTS = ['relevance', 'date', 'views'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

/** `fuzzy` is the trigram fallback, taken only when the lexical query matched nothing at all. */
export type SearchMode = 'lexical' | 'fuzzy';

export const SEARCH_PAGE_SIZE_MAX = 50;
export const SEARCH_CACHE_TTL_SECONDS = 120;

/** Per caller, per minute. */
export const SEARCH_RATE_LIMITS = { search: 60, suggestions: 120 } as const;

export const SEARCH_SUGGESTIONS = {
  limit: 10,
  channelHits: 3,
  prefixMaxLength: 20,
  keptPerPrefix: 1000,
  countWindowSeconds: 10 * SECONDS_PER_MINUTE,
  ttlSeconds: 7 * SECONDS_PER_DAY,
} as const;

/**
 * The blend every adapter scores with. A text match (`ts_rank_cd`, or trigram word similarity in
 * the fallback) is scaled by a logarithmic popularity term, so a famous result outranks an obscure
 * one of equal relevance without drowning a better match.
 */
export const SEARCH_RANKING = {
  viewsOffset: 10,
  subscribersOffset: 10,
  playlistVideosOffset: 5,
  channelBoost: 1.5,
  recencyScaleDays: 365,
  pinnedChannelBonus: 1000,
  fuzzyThreshold: 0.6,
  weights: { A: 1, B: 0.4, C: 0.2, D: 0.1 },
} as const;

export type SearchWeight = keyof typeof SEARCH_RANKING.weights;

export function searchKinds(type: SearchType): readonly SearchResultKind[] {
  switch (type) {
    case 'all':
      return ['channel', 'video', 'playlist'];
    case 'video':
    case 'channel':
    case 'playlist':
      return [type];
  }
}

export function searchHandleOf(text: string): string {
  return text.startsWith('@') ? text.slice(1) : text;
}

/**
 * A channel whose handle or display name is the whole query is pinned above everything else.
 * `text` is the query as `validateSearchQuery` normalized it.
 */
export function isExactChannelMatch(
  channel: { handle: string; displayName: string },
  text: string
): boolean {
  const wanted = searchHandleOf(text);
  return channel.handle.toLowerCase() === wanted || channel.displayName.toLowerCase() === wanted;
}

export function videoSearchScore(
  match: number,
  video: { viewsCount?: number | null; createdAt: Date },
  instantMs: number
): number {
  const ageDays = Math.max(0, (instantMs - video.createdAt.getTime()) / MS_PER_DAY);
  const recency = 1 / (1 + ageDays / SEARCH_RANKING.recencyScaleDays);
  return match * Math.log10((video.viewsCount ?? 0) + SEARCH_RANKING.viewsOffset) * recency;
}

export function channelSearchScore(
  match: number,
  channel: { subscriberCount: number },
  exact: boolean
): number {
  const score =
    match *
    Math.log10(channel.subscriberCount + SEARCH_RANKING.subscribersOffset) *
    SEARCH_RANKING.channelBoost;
  return exact ? score + SEARCH_RANKING.pinnedChannelBonus : score;
}

export function playlistSearchScore(match: number, videoCount: number): number {
  return match * Math.log10(videoCount + SEARCH_RANKING.playlistVideosOffset);
}

export interface SearchPosition {
  key: number;
  kind: SearchResultKind;
  id: string;
}

/**
 * The page a walk resumes after. It names its sort and mode, so replaying it under another sort
 * is refused, and a fuzzy walk stays fuzzy even if a lexical match appears between two pages.
 * `instant` is the clock the first page scored recency against.
 */
export interface SearchCursor extends SearchPosition {
  sort: SearchSort;
  mode: SearchMode;
  instant: number;
}

const KIND_ORDER: Record<SearchResultKind, number> = { channel: 0, video: 1, playlist: 2 };

export function compareSearchPositions(a: SearchPosition, b: SearchPosition): number {
  if (a.key !== b.key) return b.key - a.key;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * How a table holding only `kind` resumes after `cursor`, in keyset terms. A kind ordered after the
 * cursor's may repeat its key, one ordered before may not, and the cursor's own kind breaks the tie
 * on id.
 */
export type SearchKeyBound = 'at-or-below' | 'below' | 'keyset';

export function searchKeyBound(kind: SearchResultKind, cursor: SearchPosition): SearchKeyBound {
  const order = KIND_ORDER[kind] - KIND_ORDER[cursor.kind];
  if (order > 0) return 'at-or-below';
  if (order < 0) return 'below';
  return 'keyset';
}

export function searchSuggestionKey(text: string): string {
  return Array.from(text).slice(0, SEARCH_SUGGESTIONS.prefixMaxLength).join('');
}

export function searchSuggestionPrefixes(text: string): string[] {
  const chars = Array.from(searchSuggestionKey(text));
  return chars.map((_, index) => chars.slice(0, index + 1).join(''));
}

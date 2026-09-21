export type PublicFeedSort = 'recent' | 'popular' | 'trending';

export const DEFAULT_PUBLIC_FEED_SORT: PublicFeedSort = 'recent';

export const PUBLIC_FEED_VISIBILITY = 'public';
export const PUBLIC_FEED_STATUS = 'READY';

export const TRENDING_GRAVITY = {
  viewsOffset: 1,
  ageOffsetHours: 2,
  exponent: 1.5,
} as const;

const HOUR_MS = 3_600_000;

export const PUBLIC_FEED_INSTANT_GRANULARITY_MS = 60_000;

/**
 * Trending decays with wall-clock time, so a keyset walk only stays consistent while every page
 * scores against the same instant. Both adapters sample the clock in buckets, from the process
 * clock rather than the database clock.
 */
export function publicFeedInstant(nowMs: number = Date.now()): number {
  return (
    Math.floor(nowMs / PUBLIC_FEED_INSTANT_GRANULARITY_MS) * PUBLIC_FEED_INSTANT_GRANULARITY_MS
  );
}

export function videoAgeHours(createdAt: Date, nowMs: number): number {
  return Math.max(0, (nowMs - createdAt.getTime()) / HOUR_MS);
}

export function trendingScore(viewsCount: number, ageHours: number): number {
  return (
    (viewsCount + TRENDING_GRAVITY.viewsOffset) /
    (ageHours + TRENDING_GRAVITY.ageOffsetHours) ** TRENDING_GRAVITY.exponent
  );
}

export interface PublicFeedCandidate {
  id: string;
  visibility: string;
  status: string;
  deletedAt?: Date | null;
  categoryId?: string | null;
  createdAt: Date;
  viewsCount?: number | null;
}

export interface PublicFeedCursor {
  createdAt?: Date;
  viewsCount?: number;
  score?: number;
  id: string;
}

export type PublicFeedCursorField = 'createdAt' | 'viewsCount' | 'score';

export interface PublicFeedRanking {
  readonly cursorField: PublicFeedCursorField;
  rankOf(video: PublicFeedCandidate, nowMs: number): number;
  cursorRankOf(cursor: PublicFeedCursor): number | undefined;
}

export const PUBLIC_FEED_RANKINGS: Record<PublicFeedSort, PublicFeedRanking> = {
  recent: {
    cursorField: 'createdAt',
    rankOf: (video) => video.createdAt.getTime(),
    cursorRankOf: (cursor) => cursor.createdAt?.getTime(),
  },
  popular: {
    cursorField: 'viewsCount',
    rankOf: (video) => video.viewsCount ?? 0,
    cursorRankOf: (cursor) => cursor.viewsCount,
  },
  trending: {
    cursorField: 'score',
    rankOf: (video, nowMs) =>
      trendingScore(video.viewsCount ?? 0, videoAgeHours(video.createdAt, nowMs)),
    cursorRankOf: (cursor) => cursor.score,
  },
};

export function publicFeedRanking(sort?: PublicFeedSort | null): PublicFeedRanking {
  return PUBLIC_FEED_RANKINGS[sort ?? DEFAULT_PUBLIC_FEED_SORT] ?? PUBLIC_FEED_RANKINGS.recent;
}

export function isPublicFeedEligible(
  video: PublicFeedCandidate,
  categoryId?: string | null
): boolean {
  if (video.visibility !== PUBLIC_FEED_VISIBILITY) return false;
  if (video.status !== PUBLIC_FEED_STATUS) return false;
  if (video.deletedAt) return false;
  if (categoryId && video.categoryId !== categoryId) return false;
  return true;
}

export interface RankedFeedEntry {
  rank: number;
  id: string;
}

export function comparePublicFeedRank(a: RankedFeedEntry, b: RankedFeedEntry): number {
  if (a.rank !== b.rank) return b.rank - a.rank;
  return b.id.localeCompare(a.id);
}

export function isAfterPublicFeedCursor(
  candidate: RankedFeedEntry,
  cursor: RankedFeedEntry
): boolean {
  return (
    candidate.rank < cursor.rank || (candidate.rank === cursor.rank && candidate.id < cursor.id)
  );
}

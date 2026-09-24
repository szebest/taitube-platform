import { MS_PER_HOUR } from '@vp/domain/time';

export type PublicFeedSort = 'recent' | 'popular' | 'trending';

const DEFAULT_PUBLIC_FEED_SORT: PublicFeedSort = 'recent';

export const PUBLIC_FEED_VISIBILITY = 'public';
export const PUBLIC_FEED_STATUS = 'READY';

export const TRENDING_GRAVITY = {
  viewsOffset: 1,
  ageOffsetHours: 2,
  exponent: 1.5,
} as const;

export const PUBLIC_FEED_INSTANT_GRANULARITY_MS = 60_000;

export function publicFeedInstant(nowMs: number = Date.now()): number {
  return (
    Math.floor(nowMs / PUBLIC_FEED_INSTANT_GRANULARITY_MS) * PUBLIC_FEED_INSTANT_GRANULARITY_MS
  );
}

/**
 * Trending decays with wall-clock time, so a keyset walk only stays consistent while every
 * page scores against one instant. The first page samples the process clock; every later
 * page takes the instant back off the cursor rather than sampling again.
 */
export function publicFeedWalkInstant(cursor?: PublicFeedCursor | null): number {
  return cursor ? cursor.instant : publicFeedInstant();
}

function videoAgeHours(createdAt: Date, nowMs: number): number {
  return Math.max(0, (nowMs - createdAt.getTime()) / MS_PER_HOUR);
}

function trendingScore(viewsCount: number, ageHours: number): number {
  return (
    (viewsCount + TRENDING_GRAVITY.viewsOffset) /
    (ageHours + TRENDING_GRAVITY.ageOffsetHours) ** TRENDING_GRAVITY.exponent
  );
}

/** Everything a rank is derived from, whether it is read off a row or off a cursor. */
interface PublicFeedRankInput {
  createdAt: Date;
  viewsCount?: number | null;
}

export interface PublicFeedCandidate extends PublicFeedRankInput {
  id: string;
  visibility: string;
  status: string;
  deletedAt?: Date | null;
  categoryId?: string | null;
}

/**
 * A cursor names the row it resumes after by that row's rank inputs, never by a rank. Each
 * adapter recomputes the bound in its own arithmetic, so a double Postgres produced is never
 * compared against one JavaScript produced — the two disagree by an ULP often enough to
 * repeat a row at every page boundary.
 */
export interface PublicFeedCursor extends PublicFeedRankInput {
  id: string;
  instant: number;
}

export type PublicFeedRank = (input: PublicFeedRankInput, nowMs: number) => number;

const PUBLIC_FEED_RANKINGS: Record<PublicFeedSort, PublicFeedRank> = {
  recent: (input) => input.createdAt.getTime(),
  popular: (input) => input.viewsCount ?? 0,
  trending: (input, nowMs) =>
    trendingScore(input.viewsCount ?? 0, videoAgeHours(input.createdAt, nowMs)),
};

export function publicFeedRanking(sort?: PublicFeedSort | null): PublicFeedRank {
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

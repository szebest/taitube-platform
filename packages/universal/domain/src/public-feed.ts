import { MS_PER_HOUR } from '@vp/domain/time';
import type { VideoFormat } from './status-vocabulary';

export type PublicFeedSort = 'recent' | 'popular' | 'trending' | 'shorts';

const DEFAULT_PUBLIC_FEED_SORT: PublicFeedSort = 'recent';

export const PUBLIC_FEED_VISIBILITY = 'public';
export const PUBLIC_FEED_STATUS = 'READY';

export const TRENDING_GRAVITY = {
  viewsOffset: 1,
  ageOffsetHours: 2,
  exponent: 1.5,
} as const;

/** Shorts rank as trending, multiplied by up to `1 + boost` for a new upload, fading to 1 at `windowHours`. */
export const SHORTS_FRESHNESS = { boost: 2, windowHours: 48 } as const;

export const PUBLIC_FEED_SEEN_LIMIT = 60;

/** @internal */
export const PUBLIC_FEED_INSTANT_GRANULARITY_MS = 60_000;

/** @internal */
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

function freshnessBoost(ageHours: number): number {
  const remaining = Math.max(0, 1 - ageHours / SHORTS_FRESHNESS.windowHours);
  return 1 + SHORTS_FRESHNESS.boost * remaining;
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
  ownerId: string;
  visibility: string;
  status: string;
  deletedAt?: Date | null;
  categoryId?: string | null;
  format?: VideoFormat;
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
  /** Ids the walk already served, newest last, capped at `PUBLIC_FEED_SEEN_LIMIT`. */
  seen?: readonly string[];
}

export type PublicFeedRank = (input: PublicFeedRankInput, nowMs: number) => number;

const PUBLIC_FEED_RANKINGS: Record<PublicFeedSort, PublicFeedRank> = {
  recent: (input) => input.createdAt.getTime(),
  popular: (input) => input.viewsCount ?? 0,
  trending: (input, nowMs) =>
    trendingScore(input.viewsCount ?? 0, videoAgeHours(input.createdAt, nowMs)),
  shorts: (input, nowMs) => {
    const age = videoAgeHours(input.createdAt, nowMs);
    return trendingScore(input.viewsCount ?? 0, age) * freshnessBoost(age);
  },
};

export function publicFeedRanking(sort?: PublicFeedSort | null): PublicFeedRank {
  return PUBLIC_FEED_RANKINGS[sort ?? DEFAULT_PUBLIC_FEED_SORT] ?? PUBLIC_FEED_RANKINGS.recent;
}

/** Narrows the feed to a category, an owner and a format; an absent field narrows nothing. */
export interface PublicFeedFilter {
  categoryId?: string | null;
  ownerId?: string;
  format?: VideoFormat;
}

export function isPublicFeedEligible(
  video: PublicFeedCandidate,
  { categoryId, ownerId, format }: PublicFeedFilter = {}
): boolean {
  if (video.visibility !== PUBLIC_FEED_VISIBILITY) return false;
  if (video.status !== PUBLIC_FEED_STATUS) return false;
  if (video.deletedAt) return false;
  if (categoryId && video.categoryId !== categoryId) return false;
  if (ownerId && video.ownerId !== ownerId) return false;
  if (format && video.format !== format) return false;
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

export function isUnseenByPublicFeedCursor(
  candidate: { id: string },
  cursor?: PublicFeedCursor | null
): boolean {
  return !cursor?.seen?.includes(candidate.id);
}

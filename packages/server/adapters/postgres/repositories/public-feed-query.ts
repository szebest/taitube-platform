import type { ListPublicVideosOptions } from '@vp/core/repositories';
import { videos } from '@vp/db';
import {
  PUBLIC_FEED_STATUS,
  type PublicFeedCursor,
  type PublicFeedSort,
  TRENDING_GRAVITY,
} from '@vp/domain';
import { type SQL, desc, eq, isNull, sql } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, publicVisibilityScope } from '../scopes/index';

interface RankInput {
  createdAt: SQL;
  viewsCount: SQL;
}

const ROW_RANK_INPUT: RankInput = {
  createdAt: sql`${videos.createdAt}`,
  viewsCount: sql`${videos.viewsCount}`,
};

function constant(value: number): SQL {
  return sql.raw(String(value));
}

function ageHours(createdAt: SQL, instant: Date): SQL {
  return sql`greatest(0, extract(epoch from (${instant}::timestamptz - ${createdAt})) / 3600.0)`;
}

function rankExpression(
  sort: PublicFeedSort | null | undefined,
  input: RankInput,
  instant: Date
): SQL {
  if (sort === 'popular') return input.viewsCount;
  if (sort === 'trending') {
    return sql`(${input.viewsCount}::double precision + ${constant(TRENDING_GRAVITY.viewsOffset)}) / power(${ageHours(input.createdAt, instant)} + ${constant(TRENDING_GRAVITY.ageOffsetHours)}, ${constant(TRENDING_GRAVITY.exponent)})`;
  }
  return input.createdAt;
}

/**
 * The cursor bound is the same expression over the cursor's own values, so Postgres compares
 * two doubles it produced itself rather than one the API computed in JavaScript.
 */
function cursorRankInput(cursor: PublicFeedCursor): RankInput {
  return {
    createdAt: sql`${cursor.createdAt}::timestamptz`,
    viewsCount: sql`${cursor.viewsCount ?? 0}::integer`,
  };
}

export function publicFeedRank(sort: PublicFeedSort | null | undefined, instant: Date): SQL {
  return rankExpression(sort, ROW_RANK_INPUT, instant);
}

export function publicFeedScope(categoryId?: string | null): SQL | undefined {
  return drizzleWhere(
    publicVisibilityScope(videos),
    eq(videos.status, PUBLIC_FEED_STATUS),
    isNull(videos.deletedAt),
    categoryId ? eq(videos.categoryId, categoryId) : undefined
  );
}

export function publicFeedOrderBy(options: ListPublicVideosOptions, instant: Date): SQL[] {
  return [desc(publicFeedRank(options.sort, instant)), desc(videos.id)];
}

export function publicFeedCursorScope(
  options: ListPublicVideosOptions,
  instant: Date
): SQL | undefined {
  const { cursor } = options;
  if (!cursor) return undefined;

  return keysetBefore(publicFeedRank(options.sort, instant), videos.id, {
    sort: rankExpression(options.sort, cursorRankInput(cursor), instant),
    tie: cursor.id,
  });
}

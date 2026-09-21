import {
  PUBLIC_FEED_STATUS,
  type PublicFeedSort,
  TRENDING_GRAVITY,
  publicFeedRanking,
} from '@vp/core/domain';
import type { ListPublicVideosOptions } from '@vp/core/repositories';
import { videos } from '@vp/db';
import { type SQL, desc, eq, isNull, sql } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, publicVisibilityScope } from '../scopes/index';

function constant(value: number): SQL {
  return sql.raw(String(value));
}

function ageHours(instant: Date): SQL {
  return sql`greatest(0, extract(epoch from (${instant}::timestamptz - ${videos.createdAt})) / 3600.0)`;
}

export function publicFeedRank(sort: PublicFeedSort | null | undefined, instant: Date): SQL {
  if (sort === 'popular') return sql`${videos.viewsCount}`;
  if (sort === 'trending') {
    return sql`(${videos.viewsCount}::double precision + ${constant(TRENDING_GRAVITY.viewsOffset)}) / power(${ageHours(instant)} + ${constant(TRENDING_GRAVITY.ageOffsetHours)}, ${constant(TRENDING_GRAVITY.exponent)})`;
  }
  return sql`${videos.createdAt}`;
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

  const bound = cursor[publicFeedRanking(options.sort).cursorField];
  if (bound === undefined || bound === null) return undefined;

  return keysetBefore(publicFeedRank(options.sort, instant), videos.id, {
    sort: bound,
    tie: cursor.id,
  });
}

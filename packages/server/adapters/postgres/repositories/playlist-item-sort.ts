import { assertNever } from '@kit/result';
import * as schema from '@vp/db';
import {
  PLAYLIST_POSITION_SORT_OFFSET,
  PLAYLIST_WATCHED_SORT_SHIFT,
  type PlaylistItemSort,
  SERIES_EPISODE_DONE_PERCENT,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type SQL, type SQLWrapper, and, asc, desc, eq, sql } from 'drizzle-orm';
import { constant } from './sql-constant';
import type { PostgresDatabase } from './types';

const { playlistItems: pi, videos: v, channels: ch, watchHistory: wh } = schema;

export interface SortKey {
  key: SQL;
  order: 'asc' | 'desc';
}

type Columns = { position: SQLWrapper; addedAt: SQLWrapper };

/** Watched is the viewer's fact: 92 percent of it played. A guest has watched nothing. */
function watched(viewer: UserContext | null): SQL {
  if (!viewer) return sql`0`;
  return sql`(case when exists (select 1 from ${wh} where ${wh.userId} = ${viewer.id}
    and ${wh.videoId} = ${v.id}
    and ${wh.progressSeconds} * 100 >= ${wh.durationSeconds} * ${SERIES_EPISODE_DONE_PERCENT})
    then 1 else 0 end)`;
}

/**
 * One scalar per sort, so a page boundary is a single `(key, id)` comparison, `unwatched_first`
 * packed as `unwatchedFirstKey` packs it. A number travels as float8, exact this far below 2^53, so
 * the cursor carries the very value the walk compares.
 */
export function sortKeyOf(
  sort: PlaylistItemSort,
  viewer: UserContext | null,
  columns: Columns
): SortKey {
  switch (sort) {
    case 'manual':
      return { key: sql`${columns.position}::float8`, order: 'asc' };
    case 'added':
      return {
        key: sql`(extract(epoch from date_trunc('milliseconds', ${columns.addedAt})) * 1000)::float8`,
        order: 'desc',
      };
    case 'duration':
      return { key: sql`coalesce(${v.durationMs}, 0)::float8`, order: 'asc' };
    case 'channel':
      return { key: sql`lower(coalesce(${ch.displayName}, ''))`, order: 'asc' };
    case 'unwatched_first':
      return {
        key: sql`(${watched(viewer)} * ${constant(PLAYLIST_WATCHED_SORT_SHIFT)} + ${columns.position} + ${constant(PLAYLIST_POSITION_SORT_OFFSET)})::float8`,
        order: 'asc',
      };
    default:
      return assertNever(sort, 'PlaylistItemSort');
  }
}

/** Every row id in `sort` for the viewer, videos first and sections after them as they stood. */
export async function sortedOrder(
  tx: PostgresDatabase,
  playlistId: string,
  sort: Exclude<PlaylistItemSort, 'manual'>,
  viewer: UserContext
): Promise<string[]> {
  const { key, order } = sortKeyOf(sort, viewer, pi);
  const direction = order === 'asc' ? asc : desc;
  const videos = await tx
    .select({ id: pi.id })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .leftJoin(ch, eq(ch.id, v.channelId))
    .where(eq(pi.playlistId, playlistId))
    .orderBy(direction(key), direction(pi.id));
  const sections = await tx
    .select({ id: pi.id })
    .from(pi)
    .where(and(eq(pi.playlistId, playlistId), eq(pi.kind, 'section')))
    .orderBy(asc(pi.position), asc(pi.id));
  return [...videos, ...sections].map((row) => row.id);
}

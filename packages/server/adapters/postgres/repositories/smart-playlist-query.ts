import { MS_PER_DAY, MS_PER_SECOND } from '@kit/primitives';
import { assertNever } from '@kit/result';
import { videos as v, watchHistory as wh } from '@vp/db';
import {
  SERIES_EPISODE_DONE_PERCENT,
  SMART_PLAYLIST_SORT_KEYS,
  SMART_PLAYLIST_VIDEO_FORMATS,
  type SmartPlaylistCondition,
  type SmartPlaylistDuration,
  type SmartPlaylistRules,
  type SmartPlaylistSort,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import {
  type SQL,
  and,
  arrayOverlaps,
  between,
  eq,
  gt,
  gte,
  inArray,
  lt,
  or,
  sql,
} from 'drizzle-orm';

function durationSql(duration: SmartPlaylistDuration): SQL | undefined {
  switch (duration.op) {
    case 'under':
      return lt(v.durationMs, duration.seconds * MS_PER_SECOND);
    case 'over':
      return gt(v.durationMs, duration.seconds * MS_PER_SECOND);
    case 'between':
      return between(
        v.durationMs,
        duration.minSeconds * MS_PER_SECOND,
        duration.maxSeconds * MS_PER_SECOND
      );
    default:
      return assertNever(duration, 'SmartPlaylistDuration');
  }
}

/** Watched is 92 percent played, as a series and a watch list count it; a guest has watched nothing. */
function unwatchedSql(viewer: UserContext | null): SQL | undefined {
  if (!viewer) return undefined;
  return sql`not exists (select 1 from ${wh} where ${wh.userId} = ${viewer.id}
    and ${wh.videoId} = ${v.id}
    and ${wh.progressSeconds} * 100 >= ${wh.durationSeconds} * ${SERIES_EPISODE_DONE_PERCENT})`;
}

/**
 * One condition as a predicate over `videos`; `undefined` matches every row.
 * @internal
 */
export function conditionSql(
  condition: SmartPlaylistCondition,
  viewer: UserContext | null,
  now: Date
): SQL | undefined {
  switch (condition.field) {
    case 'channel':
      return inArray(v.channelId, [...condition.channelIds]);
    case 'tag':
      return arrayOverlaps(v.tags, [...condition.tags]);
    case 'category':
      return eq(v.categoryId, condition.categoryId);
    case 'duration':
      return durationSql(condition.duration);
    case 'format':
      return eq(v.format, SMART_PLAYLIST_VIDEO_FORMATS[condition.format]);
    case 'newer_than':
      return gte(v.createdAt, new Date(now.getTime() - condition.days * MS_PER_DAY));
    case 'unwatched':
      return unwatchedSql(viewer);
    default:
      return assertNever(condition, 'SmartPlaylistCondition');
  }
}

/**
 * Every condition at once under `all`, any one of them under `any`. A condition that matches every
 * row stands for `true`, so `any` with a guest's `unwatched` matches everything, as it should.
 */
export function rulesSql(
  rules: SmartPlaylistRules,
  viewer: UserContext | null,
  now: Date
): SQL | undefined {
  if (rules.conditions.length === 0) return undefined;
  const predicates = rules.conditions.map(
    (condition) => conditionSql(condition, viewer, now) ?? sql`true`
  );
  return rules.match === 'all' ? and(...predicates) : or(...predicates);
}

/** The scalar a smart sort compares, as float8 so the cursor carries the very value compared. */
export function smartSortKey(sort: SmartPlaylistSort): { key: SQL; order: 'asc' | 'desc' } {
  const { key, order } = SMART_PLAYLIST_SORT_KEYS[sort];
  switch (key) {
    case 'createdAt':
      return {
        key: sql`(extract(epoch from date_trunc('milliseconds', ${v.createdAt})) * 1000)::float8`,
        order,
      };
    case 'views':
      return { key: sql`${v.viewsCount}::float8`, order };
    case 'duration':
      return { key: sql`coalesce(${v.durationMs}, 0)::float8`, order };
    default:
      return assertNever(key, 'SmartPlaylistSortKey');
  }
}

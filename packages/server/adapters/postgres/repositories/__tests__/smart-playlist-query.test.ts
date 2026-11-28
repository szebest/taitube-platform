import type { SmartPlaylistCondition, SmartPlaylistRules, SmartPlaylistSort } from '@vp/domain';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { conditionSql, rulesSql, smartSortKey } from '../smart-playlist-query';

const dialect = new PgDialect();
const NOW = new Date('2026-11-27T00:00:00.000Z');
const VIEWER = { id: 'user-1', role: 'USER' } as const;

function query(fragment: SQL | undefined) {
  if (!fragment) return null;
  const { sql, params } = dialect.sqlToQuery(fragment);
  return { sql: sql.replace(/\s+/g, ' '), params };
}

describe('adapters/postgres: smart playlist rules as SQL', () => {
  it.each<{ condition: SmartPlaylistCondition; sql: string; params: unknown[] }>([
    {
      condition: { field: 'channel', channelIds: ['ch-1', 'ch-2'] },
      sql: '"videos"."channel_id" in ($1, $2)',
      params: ['ch-1', 'ch-2'],
    },
    {
      condition: { field: 'tag', tags: ['jazz'] },
      sql: '"videos"."tags" && $1',
      params: ['{"jazz"}'],
    },
    {
      condition: { field: 'category', categoryId: 'cat-1' },
      sql: '"videos"."category_id" = $1',
      params: ['cat-1'],
    },
    {
      condition: { field: 'duration', duration: { op: 'under', seconds: 600 } },
      sql: '"videos"."duration_ms" < $1',
      params: [600_000],
    },
    {
      condition: { field: 'duration', duration: { op: 'over', seconds: 60 } },
      sql: '"videos"."duration_ms" > $1',
      params: [60_000],
    },
    {
      condition: {
        field: 'duration',
        duration: { op: 'between', minSeconds: 60, maxSeconds: 120 },
      },
      sql: '"videos"."duration_ms" between $1 and $2',
      params: [60_000, 120_000],
    },
    {
      condition: { field: 'format', format: 'long' },
      sql: '"videos"."format" = $1',
      params: ['standard'],
    },
    {
      condition: { field: 'format', format: 'short' },
      sql: '"videos"."format" = $1',
      params: ['short'],
    },
    {
      condition: { field: 'newer_than', days: 30 },
      sql: '"videos"."created_at" >= $1',
      params: ['2026-10-28T00:00:00.000Z'],
    },
    {
      condition: { field: 'unwatched' },
      sql: 'not exists (select 1 from "watch_history" where "watch_history"."user_id" = $1 and "watch_history"."video_id" = "videos"."id" and "watch_history"."progress_seconds" * 100 >= "watch_history"."duration_seconds" * $2)',
      params: ['user-1', 92],
    },
  ])('maps $condition.field to its predicate', ({ condition, sql, params }) => {
    expect(query(conditionSql(condition, VIEWER, NOW))).toEqual({ sql, params });
  });

  it('matches every row on unwatched for a guest', () => {
    expect(conditionSql({ field: 'unwatched' }, null, NOW)).toBeUndefined();
  });

  it.each([
    { match: 'all' as const, joiner: 'and' },
    { match: 'any' as const, joiner: 'or' },
  ])(
    'joins the conditions of $match with $joiner, a guest unwatched standing for true',
    ({ match, joiner }) => {
      const rules: SmartPlaylistRules = {
        match,
        conditions: [{ field: 'category', categoryId: 'cat-1' }, { field: 'unwatched' }],
        sort: 'newest',
        limit: 10,
      };

      expect(query(rulesSql(rules, null, NOW))?.sql).toBe(
        `("videos"."category_id" = $1 ${joiner} true)`
      );
    }
  );

  it('puts no predicate on rules with no conditions', () => {
    expect(
      rulesSql({ match: 'all', conditions: [], sort: 'newest', limit: 10 }, null, NOW)
    ).toBeUndefined();
  });

  it.each<{ sort: SmartPlaylistSort; sql: string; order: 'asc' | 'desc' }>([
    {
      sort: 'newest',
      sql: `(extract(epoch from date_trunc('milliseconds', "videos"."created_at")) * 1000)::float8`,
      order: 'desc',
    },
    {
      sort: 'oldest',
      sql: `(extract(epoch from date_trunc('milliseconds', "videos"."created_at")) * 1000)::float8`,
      order: 'asc',
    },
    { sort: 'popular', sql: '"videos"."views_count"::float8', order: 'desc' },
    { sort: 'shortest', sql: 'coalesce("videos"."duration_ms", 0)::float8', order: 'asc' },
    { sort: 'longest', sql: 'coalesce("videos"."duration_ms", 0)::float8', order: 'desc' },
  ])('keys $sort on one float, $order', ({ sort, sql, order }) => {
    const { key, order: direction } = smartSortKey(sort);

    expect([query(key)?.sql, direction]).toEqual([sql, order]);
  });
});

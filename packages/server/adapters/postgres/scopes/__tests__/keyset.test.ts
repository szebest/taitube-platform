import { videos } from '@vp/db';
import { sql } from 'drizzle-orm';
import { keysetBefore } from '../keyset';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres/scoping: keyset scope', () => {
  const createdAt = new Date('2024-05-01T00:00:00.000Z');

  it('compares the sort column first and breaks ties on the tiebreaker', () => {
    const scope = keysetBefore(videos.createdAt, videos.id, { sort: createdAt, tie: 'video-1' });

    expect(sqlText(scope)).toBe(
      '("videos"."created_at" < $1 or ("videos"."created_at" = $2 and "videos"."id" < $3))'
    );
    const iso = createdAt.toISOString();
    expect(sqlParams(scope)).toEqual([iso, iso, 'video-1']);
  });

  it('accepts a ranking expression as the sort key', () => {
    const rank = sql`${videos.viewsCount} * 2`;
    const scope = keysetBefore(rank, videos.id, { sort: 42, tie: 'video-1' });

    expect(sqlText(scope)).toBe(
      '("videos"."views_count" * 2 < $1 or ("videos"."views_count" * 2 = $2 and "videos"."id" < $3))'
    );
    expect(sqlParams(scope)).toEqual([42, 42, 'video-1']);
  });

  it.each([
    { name: 'an absent cursor', cursor: undefined },
    { name: 'a null cursor', cursor: null },
  ])('scopes nothing for $name', ({ cursor }) => {
    expect(keysetBefore(videos.createdAt, videos.id, cursor)).toBeUndefined();
  });
});

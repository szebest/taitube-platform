import { videos } from '@vp/db';
import { eq } from 'drizzle-orm';
import { type WhereCondition, drizzleWhere } from '../where';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres/scoping: where condition combiner', () => {
  it.each<{ name: string; conditions: WhereCondition[] }>([
    { name: 'no conditions at all', conditions: [] },
    { name: 'only null, undefined and false', conditions: [undefined, null, false] },
  ])('returns undefined given $name', ({ conditions }) => {
    expect(drizzleWhere(...conditions)).toBeUndefined();
  });

  it('returns the single active condition untouched', () => {
    const cond = eq(videos.id, 'vid-1');
    expect(drizzleWhere(undefined, cond, false, null)).toBe(cond);
  });

  it('combines the active conditions and drops the inactive ones', () => {
    const result = drizzleWhere(
      eq(videos.id, 'vid-1'),
      undefined,
      eq(videos.status, 'READY'),
      false
    );
    expect(sqlText(result)).toBe('("videos"."id" = $1 and "videos"."status" = $2)');
    expect(sqlParams(result)).toEqual(['vid-1', 'READY']);
  });
});

import { videos } from '@vp/db';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { drizzleWhere } from '../where';

describe('adapters/postgres/scoping: where condition combiner', () => {
  it('returns undefined when all conditions are null, undefined, or false', () => {
    expect(drizzleWhere()).toBeUndefined();
    expect(drizzleWhere(undefined, null, false)).toBeUndefined();
  });

  it('returns the single condition directly when only one is truthy', () => {
    const cond = eq(videos.id, 'vid-1');
    const result = drizzleWhere(undefined, cond, false, null);
    expect(result).toBe(cond);
  });

  it('combines multiple conditions into an and() clause', () => {
    const cond1 = eq(videos.id, 'vid-1');
    const cond2 = eq(videos.status, 'READY');
    const result = drizzleWhere(cond1, undefined, cond2, false);
    expect(result).toBeDefined();
  });
});

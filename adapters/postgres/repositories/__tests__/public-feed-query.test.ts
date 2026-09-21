import {
  TRENDING_GRAVITY,
} from '@vp/core/domain';
import { sqlParams, sqlText } from '../../scopes/__tests__/sql-text';
import {
  publicFeedCursorScope,
  publicFeedOrderBy,
  publicFeedRank,
  publicFeedScope,
} from '../public-feed-query';

const INSTANT = new Date('2026-01-01T00:00:00.000Z');

describe('adapters/postgres: public feed SQL query', () => {
  describe('scope', () => {
    it('restricts the feed to public, ready, undeleted rows', () => {
      const scope = publicFeedScope();
      expect(sqlText(scope)).toBe(
        '("videos"."visibility" = $1 and "videos"."status" = $2 and "videos"."deleted_at" is null)'
      );
      expect(sqlParams(scope)).toEqual(['public', 'READY']);
    });

    it('adds the category predicate only when one is requested', () => {
      expect(sqlText(publicFeedScope(null))).not.toContain('category_id');
      const scoped = publicFeedScope('cat-1');
      expect(sqlText(scoped)).toContain('"videos"."category_id" = $3');
      expect(sqlParams(scoped)).toEqual(['public', 'READY', 'cat-1']);
    });
  });

  describe('rank expression', () => {
    it.each([
      { sort: undefined, expected: '"videos"."created_at"' },
      { sort: 'recent' as const, expected: '"videos"."created_at"' },
      { sort: 'popular' as const, expected: '"videos"."views_count"' },
    ])('keys $sort on $expected', ({ sort, expected }) => {
      expect(sqlText(publicFeedRank(sort, INSTANT))).toBe(expected);
    });

    it('spells the trending gravity curve out of the shared constants', () => {
      const age =
        'greatest(0, extract(epoch from ($1::timestamptz - "videos"."created_at")) / 3600.0)';
      expect(sqlText(publicFeedRank('trending', INSTANT))).toBe(
        `("videos"."views_count"::double precision + ${TRENDING_GRAVITY.viewsOffset}) / power(${age} + ${TRENDING_GRAVITY.ageOffsetHours}, ${TRENDING_GRAVITY.exponent})`
      );
      expect(sqlParams(publicFeedRank('trending', INSTANT))).toEqual([INSTANT]);
    });

    it('scores against the supplied instant rather than the database clock', () => {
      expect(sqlText(publicFeedRank('trending', INSTANT))).not.toContain('now()');
    });
  });

  describe('order by', () => {
    it('sorts by rank then id, both descending', () => {
      const [rank, tieBreak] = publicFeedOrderBy({ limit: 10, sort: 'popular' }, INSTANT);
      expect(sqlText(rank)).toBe('"videos"."views_count" desc');
      expect(sqlText(tieBreak)).toBe('"videos"."id" desc');
    });
  });

  describe('keyset cursor', () => {
    it('is absent without a cursor', () => {
      expect(publicFeedCursorScope({ limit: 10 }, INSTANT)).toBeUndefined();
    });

    it.each([
      { sort: 'recent' as const, cursor: { id: 'v1' } },
      { sort: 'popular' as const, cursor: { id: 'v1', createdAt: new Date() } },
      { sort: 'trending' as const, cursor: { id: 'v1', viewsCount: 3 } },
    ])('is absent when the cursor carries no $sort key', ({ sort, cursor }) => {
      expect(publicFeedCursorScope({ limit: 10, sort, cursor }, INSTANT)).toBeUndefined();
    });

    it('takes the rows strictly after the cursor, breaking ties on the id', () => {
      const scope = publicFeedCursorScope(
        { limit: 10, sort: 'popular', cursor: { id: 'v1', viewsCount: 42 } },
        INSTANT
      );
      expect(sqlText(scope)).toBe(
        '("videos"."views_count" < $1 or ("videos"."views_count" = $2 and "videos"."id" < $3))'
      );
      expect(sqlParams(scope)).toEqual([42, 42, 'v1']);
    });

    it('bounds the recent feed on the cursor timestamp', () => {
      const createdAt = new Date('2025-06-01T12:00:00.000Z');
      const scope = publicFeedCursorScope(
        { limit: 10, sort: 'recent', cursor: { id: 'v1', createdAt } },
        INSTANT
      );
      expect(sqlParams(scope)).toEqual([createdAt, createdAt, 'v1']);
    });
  });
});

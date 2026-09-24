import { TRENDING_GRAVITY } from '@vp/domain';
import type { PublicFeedSort } from '@vp/domain';
import { sqlParams, sqlText } from '../../scopes/__tests__/sql-text';
import { publicFeedCursorScope, publicFeedOrderBy, publicFeedScope } from '../public-feed-query';

const INSTANT = new Date('2026-01-01T00:00:00.000Z');
const INSTANT_TEXT = INSTANT.toISOString();

function rankOrder(sort: PublicFeedSort | undefined) {
  return publicFeedOrderBy({ limit: 10, sort }, INSTANT)[0];
}

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
      { sort: undefined, expected: '"videos"."created_at" desc' },
      { sort: 'recent' as const, expected: '"videos"."created_at" desc' },
      { sort: 'popular' as const, expected: '"videos"."views_count" desc' },
    ])('keys $sort on $expected', ({ sort, expected }) => {
      expect(sqlText(rankOrder(sort))).toBe(expected);
    });

    it('spells the trending gravity curve out of the shared constants', () => {
      const age =
        'greatest(0, extract(epoch from ($1::timestamptz - "videos"."created_at")) / 3600.0)';
      expect(sqlText(rankOrder('trending'))).toBe(
        `("videos"."views_count"::double precision + ${TRENDING_GRAVITY.viewsOffset}) / power(${age} + ${TRENDING_GRAVITY.ageOffsetHours}, ${TRENDING_GRAVITY.exponent}) desc`
      );
      expect(sqlParams(rankOrder('trending'))).toEqual([INSTANT_TEXT]);
    });

    it('scores against the supplied instant rather than the database clock', () => {
      expect(sqlText(rankOrder('trending'))).not.toContain('now()');
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
    const CURSOR_CREATED_AT = new Date('2025-06-01T12:00:00.000Z');
    const CURSOR = {
      id: 'v1',
      createdAt: CURSOR_CREATED_AT,
      viewsCount: 42,
      instant: INSTANT.getTime(),
    };

    it('is absent without a cursor', () => {
      expect(publicFeedCursorScope({ limit: 10 }, INSTANT)).toBeUndefined();
    });

    it.each([
      { sort: 'recent' as const, key: '"videos"."created_at"', cast: '::timestamptz' },
      { sort: 'popular' as const, key: '"videos"."views_count"', cast: '::integer' },
    ])(
      'takes the rows strictly after the $sort cursor, breaking ties on the id',
      ({ sort, key, cast }) => {
        const scope = publicFeedCursorScope({ limit: 10, sort, cursor: CURSOR }, INSTANT);
        expect(sqlText(scope)).toBe(
          `(${key} < $1${cast} or (${key} = $2${cast} and "videos"."id" < $3))`
        );
      }
    );

    it.each([
      { sort: 'recent' as const, key: CURSOR_CREATED_AT.toISOString() },
      { sort: 'popular' as const, key: 42 },
    ])('binds the $sort keyset off the cursor row', ({ sort, key }) => {
      const scope = publicFeedCursorScope({ limit: 10, sort, cursor: CURSOR }, INSTANT);
      expect(sqlParams(scope)).toEqual([key, key, 'v1']);
    });

    it('respells the gravity curve over the cursor row instead of carrying its score', () => {
      const scope = publicFeedCursorScope({ limit: 10, sort: 'trending', cursor: CURSOR }, INSTANT);
      const age = 'greatest(0, extract(epoch from ($3::timestamptz - $4::timestamptz)) / 3600.0)';
      const bound = `($2::integer::double precision + ${TRENDING_GRAVITY.viewsOffset}) / power(${age} + ${TRENDING_GRAVITY.ageOffsetHours}, ${TRENDING_GRAVITY.exponent})`;

      expect(sqlText(scope)).toContain(`< ${bound}`);
      expect(sqlParams(scope)).toEqual([
        INSTANT_TEXT,
        42,
        INSTANT_TEXT,
        CURSOR_CREATED_AT.toISOString(),
        INSTANT_TEXT,
        42,
        INSTANT_TEXT,
        CURSOR_CREATED_AT.toISOString(),
        'v1',
      ]);
    });

    it('never binds a score Postgres did not compute itself', () => {
      const scope = publicFeedCursorScope({ limit: 10, sort: 'trending', cursor: CURSOR }, INSTANT);
      const floats = sqlParams(scope).filter(
        (param) => typeof param === 'number' && !Number.isInteger(param)
      );
      expect(floats).toEqual([]);
    });
  });
});

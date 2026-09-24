import {
  PUBLIC_FEED_INSTANT_GRANULARITY_MS,
  type PublicFeedCandidate,
  type PublicFeedSort,
  TRENDING_GRAVITY,
  comparePublicFeedRank,
  isAfterPublicFeedCursor,
  isPublicFeedEligible,
  publicFeedInstant,
  publicFeedRanking,
  publicFeedWalkInstant,
} from '../public-feed';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const HOUR_MS = 3_600_000;

function trending(viewsCount: number, ageHours: number): number {
  return publicFeedRanking('trending')(
    video({ viewsCount, createdAt: new Date(NOW - ageHours * HOUR_MS) }),
    NOW
  );
}

function video(overrides: Partial<PublicFeedCandidate> = {}): PublicFeedCandidate {
  return {
    id: 'video-1',
    visibility: 'public',
    status: 'READY',
    categoryId: null,
    viewsCount: 0,
    createdAt: new Date(NOW),
    deletedAt: null,
    ...overrides,
  };
}

describe('packages/domain: public feed rules', () => {
  describe('eligibility', () => {
    it.each<{
      scenario: string;
      overrides?: Partial<PublicFeedCandidate>;
      categoryId?: string | null;
    }>([
      { scenario: 'a private video', overrides: { visibility: 'private' } },
      { scenario: 'an unlisted video', overrides: { visibility: 'unlisted' } },
      { scenario: 'a video still processing', overrides: { status: 'PROCESSING' } },
      { scenario: 'a soft-deleted video', overrides: { deletedAt: new Date(NOW) } },
      {
        scenario: 'a video in another category',
        overrides: { categoryId: 'cat-a' },
        categoryId: 'cat-b',
      },
      { scenario: 'an uncategorised video when a category is requested', categoryId: 'cat-b' },
    ])('excludes $scenario', ({ overrides, categoryId }) => {
      expect(isPublicFeedEligible(video(overrides), categoryId)).toBe(false);
    });

    it('includes a public ready video', () => {
      expect(isPublicFeedEligible(video())).toBe(true);
    });

    it('ignores the category filter when it is absent', () => {
      expect(isPublicFeedEligible(video({ categoryId: 'cat-a' }), null)).toBe(true);
    });
  });

  describe('trending gravity', () => {
    it('matches the documented (views + 1) / (ageHours + 2) ** 1.5 curve', () => {
      expect(trending(9, 2)).toBeCloseTo(10 / 4 ** 1.5, 10);
      expect(TRENDING_GRAVITY).toEqual({ viewsOffset: 1, ageOffsetHours: 2, exponent: 1.5 });
    });

    it('decays with age and grows with views', () => {
      expect(trending(100, 1)).toBeGreaterThan(trending(100, 10));
      expect(trending(100, 1)).toBeGreaterThan(trending(10, 1));
    });

    it('clamps a future creation date to zero age', () => {
      expect(trending(0, -1)).toBe(trending(0, 0));
      expect(trending(0, 2)).toBeCloseTo(1 / 4 ** 1.5, 10);
    });
  });

  describe('rankings', () => {
    it('defaults to the recent ranking', () => {
      expect(publicFeedRanking()).toBe(publicFeedRanking('recent'));
      expect(publicFeedRanking(null)).toBe(publicFeedRanking('recent'));
    });

    it('ranks recent on creation time', () => {
      expect(publicFeedRanking('recent')(video({ createdAt: new Date(NOW) }), NOW)).toBe(NOW);
    });

    it('ranks popular on the view count, treating an absent count as zero', () => {
      const rankOf = publicFeedRanking('popular');
      expect(rankOf(video({ viewsCount: 12 }), NOW)).toBe(12);
      expect(rankOf(video({ viewsCount: undefined }), NOW)).toBe(0);
      expect(rankOf(video({ viewsCount: null }), NOW)).toBe(0);
    });

    it.each<{ sort: PublicFeedSort }>([
      { sort: 'recent' },
      { sort: 'popular' },
      { sort: 'trending' },
    ])('ranks a $sort cursor by the same function as a row', ({ sort }) => {
      const row = video({ viewsCount: 9, createdAt: new Date(NOW - 2 * HOUR_MS) });
      const rankOf = publicFeedRanking(sort);

      expect(rankOf({ createdAt: row.createdAt, viewsCount: row.viewsCount }, NOW)).toBe(
        rankOf(row, NOW)
      );
    });
  });

  describe('walk instant', () => {
    it('buckets a fresh walk so every page of it samples one instant', () => {
      const inside = NOW + PUBLIC_FEED_INSTANT_GRANULARITY_MS - 1;
      expect(publicFeedInstant(inside)).toBe(NOW);
      expect(publicFeedInstant(NOW + PUBLIC_FEED_INSTANT_GRANULARITY_MS)).toBe(
        NOW + PUBLIC_FEED_INSTANT_GRANULARITY_MS
      );
    });

    it('takes a resumed walk back off the cursor rather than re-sampling the clock', () => {
      const minted = NOW - 10 * PUBLIC_FEED_INSTANT_GRANULARITY_MS;
      expect(
        publicFeedWalkInstant({ id: 'video-1', createdAt: new Date(NOW), instant: minted })
      ).toBe(minted);
    });

    it('samples the clock only when there is no cursor', () => {
      vi.spyOn(Date, 'now').mockReturnValue(NOW + 17);
      expect(publicFeedWalkInstant()).toBe(NOW);
      expect(publicFeedWalkInstant(null)).toBe(NOW);
      vi.restoreAllMocks();
    });
  });

  describe('ordering and keyset', () => {
    it('orders by rank descending, then id descending', () => {
      const entries = [
        { rank: 1, id: 'a' },
        { rank: 3, id: 'b' },
        { rank: 1, id: 'c' },
      ];
      expect([...entries].sort(comparePublicFeedRank).map((e) => e.id)).toEqual(['b', 'c', 'a']);
    });

    it.each([
      { scenario: 'a lower rank', candidate: { rank: 1, id: 'z' }, expected: true },
      {
        scenario: 'an equal rank and a smaller id',
        candidate: { rank: 5, id: 'a' },
        expected: true,
      },
      {
        scenario: 'an equal rank and the same id',
        candidate: { rank: 5, id: 'm' },
        expected: false,
      },
      {
        scenario: 'an equal rank and a larger id',
        candidate: { rank: 5, id: 'z' },
        expected: false,
      },
      { scenario: 'a higher rank', candidate: { rank: 9, id: 'a' }, expected: false },
    ])('places $scenario after the cursor: $expected', ({ candidate, expected }) => {
      expect(isAfterPublicFeedCursor(candidate, { rank: 5, id: 'm' })).toBe(expected);
    });
  });
});

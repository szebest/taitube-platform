import {
  DEFAULT_PUBLIC_FEED_SORT,
  PUBLIC_FEED_RANKINGS,
  type PublicFeedCandidate,
  type PublicFeedSort,
  TRENDING_GRAVITY,
  comparePublicFeedRank,
  isAfterPublicFeedCursor,
  isPublicFeedEligible,
  publicFeedRanking,
  trendingScore,
  videoAgeHours,
} from '../public-feed';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');

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
      expect(trendingScore(9, 2)).toBeCloseTo(10 / 4 ** 1.5, 10);
      expect(TRENDING_GRAVITY).toEqual({ viewsOffset: 1, ageOffsetHours: 2, exponent: 1.5 });
    });

    it('decays with age and grows with views', () => {
      expect(trendingScore(100, 1)).toBeGreaterThan(trendingScore(100, 10));
      expect(trendingScore(100, 1)).toBeGreaterThan(trendingScore(10, 1));
    });

    it('clamps a future creation date to zero age', () => {
      expect(videoAgeHours(new Date(NOW + 3_600_000), NOW)).toBe(0);
      expect(videoAgeHours(new Date(NOW - 7_200_000), NOW)).toBe(2);
    });
  });

  describe('rankings', () => {
    it('defaults to the recent ranking', () => {
      expect(publicFeedRanking()).toBe(PUBLIC_FEED_RANKINGS[DEFAULT_PUBLIC_FEED_SORT]);
      expect(publicFeedRanking(null)).toBe(PUBLIC_FEED_RANKINGS.recent);
    });

    it.each<{ sort: PublicFeedSort; cursorField: string }>([
      { sort: 'recent', cursorField: 'createdAt' },
      { sort: 'popular', cursorField: 'viewsCount' },
      { sort: 'trending', cursorField: 'score' },
    ])('$sort keys its cursor on $cursorField', ({ sort, cursorField }) => {
      expect(publicFeedRanking(sort).cursorField).toBe(cursorField);
    });

    it('ranks recent on creation time', () => {
      const ranking = publicFeedRanking('recent');
      expect(ranking.rankOf(video({ createdAt: new Date(NOW) }), NOW)).toBe(NOW);
      expect(ranking.cursorRankOf({ id: 'video-1', createdAt: new Date(NOW) })).toBe(NOW);
      expect(ranking.cursorRankOf({ id: 'video-1' })).toBeUndefined();
    });

    it('ranks popular on the view count, treating an absent count as zero', () => {
      const ranking = publicFeedRanking('popular');
      expect(ranking.rankOf(video({ viewsCount: 12 }), NOW)).toBe(12);
      expect(ranking.rankOf(video({ viewsCount: undefined }), NOW)).toBe(0);
      expect(ranking.cursorRankOf({ id: 'video-1', viewsCount: 12 })).toBe(12);
    });

    it('ranks trending on the gravity score', () => {
      const ranking = publicFeedRanking('trending');
      const created = new Date(NOW - 2 * 3_600_000);
      expect(ranking.rankOf(video({ viewsCount: 9, createdAt: created }), NOW)).toBeCloseTo(
        trendingScore(9, 2),
        10
      );
      expect(ranking.cursorRankOf({ id: 'video-1', score: 1.5 })).toBe(1.5);
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

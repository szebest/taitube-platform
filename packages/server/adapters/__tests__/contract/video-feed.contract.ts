import type { ListPublicVideosOptions, VideoRecord } from '@vp/core/repositories';
import type { PublicFeedSort } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  CATEGORY_GAMING_ID,
  CATEGORY_MUSIC_ID,
  HOUR_MS,
  VIDEO_IDS,
  idsOf,
  publicVideo,
  seedCategories,
} from './fixtures';
import type { VideoContractContext } from './video-contract-context';

interface FeedSeed {
  id: string;
  ageHours: number;
  viewsCount: number;
  categoryId: string;
}

const FEED_SEEDS: FeedSeed[] = [
  { id: VIDEO_IDS.a, ageHours: 1, viewsCount: 10, categoryId: CATEGORY_MUSIC_ID },
  { id: VIDEO_IDS.b, ageHours: 5, viewsCount: 500, categoryId: CATEGORY_GAMING_ID },
  { id: VIDEO_IDS.c, ageHours: 61.625, viewsCount: 5000, categoryId: CATEGORY_MUSIC_ID },
  { id: VIDEO_IDS.d, ageHours: 100, viewsCount: 1, categoryId: CATEGORY_GAMING_ID },
];

const FEED_INSTANT_MS = Date.parse('2026-03-01T12:00:00.000Z');

const EXPECTED_ORDER: Record<PublicFeedSort, string[]> = {
  recent: [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d],
  popular: [VIDEO_IDS.c, VIDEO_IDS.b, VIDEO_IDS.a, VIDEO_IDS.d],
  trending: [VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.a, VIDEO_IDS.d],
};

const SORTS: { sort: PublicFeedSort }[] = [
  { sort: 'recent' },
  { sort: 'popular' },
  { sort: 'trending' },
];

function cursorFor(video: VideoRecord, instant: number): ListPublicVideosOptions['cursor'] {
  return {
    id: video.id,
    createdAt: video.createdAt,
    viewsCount: video.viewsCount ?? 0,
    instant,
  };
}

export function describeVideoFeedContract(ctx: VideoContractContext): void {
  describe('listPublic', () => {
    /**
     * Trending decays against the wall clock, so a keyset cursor minted here and the rank
     * the repository recomputes only agree while both sample the same instant.
     */
    beforeEach(async () => {
      vi.spyOn(Date, 'now').mockReturnValue(FEED_INSTANT_MS);
      await seedCategories(ctx.subject.repositories);
      const now = Date.now();
      for (const seed of FEED_SEEDS) {
        await ctx.subject.seedVideo(
          publicVideo({
            id: seed.id,
            viewsCount: seed.viewsCount,
            categoryId: seed.categoryId,
          }),
          new Date(now - seed.ageHours * HOUR_MS)
        );
      }
    });

    it.each(SORTS)('orders the feed by $sort', async ({ sort }) => {
      const result = expectOk(await ctx.videos.listPublic({ limit: 10, sort }));

      expect(idsOf(result.items)).toEqual(EXPECTED_ORDER[sort]);
      expect(result.total).toBe(4);
    });

    it('defaults to the recent ordering when no sort is given', async () => {
      const result = expectOk(await ctx.videos.listPublic({ limit: 10 }));
      expect(idsOf(result.items)).toEqual(EXPECTED_ORDER.recent);
    });

    it.each<{ sort: PublicFeedSort; expected: string[] }>([
      { sort: 'recent', expected: [VIDEO_IDS.a, VIDEO_IDS.c] },
      { sort: 'popular', expected: [VIDEO_IDS.c, VIDEO_IDS.a] },
      { sort: 'trending', expected: [VIDEO_IDS.c, VIDEO_IDS.a] },
    ])('restricts $sort to the requested category', async ({ sort, expected }) => {
      const result = expectOk(
        await ctx.videos.listPublic({
          limit: 10,
          sort,
          categoryId: CATEGORY_MUSIC_ID,
        })
      );

      expect(idsOf(result.items)).toEqual(expected);
      expect(result.total).toBe(2);
    });

    it.each<{ scenario: string; input: Parameters<typeof publicVideo>[0] }>([
      { scenario: 'private videos', input: { id: VIDEO_IDS.e, visibility: 'private' } },
      { scenario: 'unlisted videos', input: { id: VIDEO_IDS.e, visibility: 'unlisted' } },
      { scenario: 'videos that are not READY', input: { id: VIDEO_IDS.e, status: 'PROCESSING' } },
      { scenario: 'soft-deleted videos', input: { id: VIDEO_IDS.e, deletedAt: new Date() } },
    ])('excludes $scenario from both the page and the total', async ({ input }) => {
      expectOk(await ctx.videos.create(publicVideo(input)));
      const result = expectOk(await ctx.videos.listPublic({ limit: 10 }));

      expect(idsOf(result.items)).not.toContain(VIDEO_IDS.e);
      expect(result.total).toBe(4);
    });

    it('over-fetches one row so the caller can detect a next page', async () => {
      const result = expectOk(await ctx.videos.listPublic({ limit: 2 }));

      expect(idsOf(result.items)).toEqual([VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]);
      expect(result.total).toBe(4);
    });

    it.each(SORTS)('resumes the $sort feed from a keyset cursor', async ({ sort }) => {
      const firstPage = expectOk(await ctx.videos.listPublic({ limit: 1, sort }));
      const last = firstPage.items[0] as VideoRecord;

      const secondPage = expectOk(
        await ctx.videos.listPublic({
          limit: 10,
          sort,
          cursor: cursorFor(last, firstPage.instant),
        })
      );

      expect(idsOf(secondPage.items)).toEqual(EXPECTED_ORDER[sort].slice(1));
      expect(secondPage.total).toBe(4);
    });

    it.each(SORTS)(
      'walks the whole $sort feed one row per page without repeating',
      async ({ sort }) => {
        const walked: string[] = [];
        let cursor: ListPublicVideosOptions['cursor'];

        for (let page = 0; page <= FEED_SEEDS.length; page += 1) {
          const result = expectOk(await ctx.videos.listPublic({ limit: 1, sort, cursor }));
          const row = result.items[0];
          if (!row) break;
          walked.push(row.id);
          if (result.items.length === 1) break;
          cursor = cursorFor(row, result.instant);
        }

        expect(walked).toEqual(EXPECTED_ORDER[sort]);
      }
    );

    it('returns an empty page for a category with no public videos', async () => {
      expectOk(
        await ctx.videos.create(
          publicVideo({ id: VIDEO_IDS.e, visibility: 'private', categoryId: null })
        )
      );
      const result = expectOk(
        await ctx.videos.listPublic({
          limit: 10,
          categoryId: '00000000-0000-7000-8000-0000000002ff',
        })
      );

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
}

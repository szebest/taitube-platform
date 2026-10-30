import type { VideoLibraryQuery, VideoStudioRepository } from '@vp/core/repositories';
import { creatorLibraryCursorOf, type LibrarySort } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  CATEGORY_GAMING_ID,
  CATEGORY_MUSIC_ID,
  HOUR_MS,
  idsOf,
  OTHER_OWNER_ID,
  OWNER_ID,
  publicVideo,
  seedCategories,
  seedOwners,
  VIDEO_IDS,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeVideoStudioLibraryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoStudioRepository.listLibrary contract', () => {
    let subject: RepositoriesSubject;
    let studio: VideoStudioRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await seedCategories(subject.repositories);
      studio = subject.repositories.videoStudio;
    });

    describe('listLibrary', () => {
      beforeEach(async () => {
        const now = Date.now();
        const seed = (hoursAgo: number, input: Parameters<typeof publicVideo>[0]) =>
          subject.seedVideo(publicVideo(input), new Date(now - hoursAgo * HOUR_MS));
        await seed(1, { id: VIDEO_IDS.a, viewsCount: 5, likesCount: 9, commentsCount: 1 });
        await seed(2, {
          id: VIDEO_IDS.b,
          status: 'PROCESSING',
          visibility: 'private',
          viewsCount: 50,
          likesCount: 1,
          commentsCount: 4,
        });
        await seed(3, { id: VIDEO_IDS.c, viewsCount: 50, likesCount: 3, commentsCount: 7 });
        await seed(4, { id: VIDEO_IDS.d, status: 'DELETED', viewsCount: 999 });
        await seed(5, { id: VIDEO_IDS.e, ownerId: OTHER_OWNER_ID, viewsCount: 999 });
      });

      const list = async (query: Partial<VideoLibraryQuery> = {}) =>
        idsOf(
          expectOk(
            await studio.listLibrary({ ownerId: OWNER_ID, sort: 'newest', limit: 10, ...query })
          )
        );

      it.each<{ sort: LibrarySort; expected: string[] }>([
        { sort: 'newest', expected: [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c] },
        { sort: 'views', expected: [VIDEO_IDS.c, VIDEO_IDS.b, VIDEO_IDS.a] },
        { sort: 'likes', expected: [VIDEO_IDS.a, VIDEO_IDS.c, VIDEO_IDS.b] },
        { sort: 'comments', expected: [VIDEO_IDS.c, VIDEO_IDS.b, VIDEO_IDS.a] },
      ])(
        'lists only the caller live videos, sorted $sort with id breaking ties',
        async ({ sort, expected }) => {
          expect(await list({ sort })).toEqual(expected);
        }
      );

      it.each([
        { name: 'status', query: { status: 'PROCESSING' as const }, expected: [VIDEO_IDS.b] },
        {
          name: 'visibility',
          query: { visibility: 'public' as const },
          expected: [VIDEO_IDS.a, VIDEO_IDS.c],
        },
        { name: 'a deleted status', query: { status: 'DELETED' as const }, expected: [] },
      ])('filters by $name', async ({ query, expected }) => {
        expect(await list(query)).toEqual(expected);
      });

      it('returns one row past the limit and resumes after the cursor without repeating', async () => {
        const firstPage = expectOk(
          await studio.listLibrary({ ownerId: OWNER_ID, sort: 'views', limit: 1 })
        );
        expect(idsOf(firstPage)).toEqual([VIDEO_IDS.c, VIDEO_IDS.b]);

        const [lastShown] = firstPage;
        if (!lastShown) throw new Error('the first page came back empty');
        const cursor = creatorLibraryCursorOf(lastShown, 'views');

        expect(await list({ sort: 'views', cursor })).toEqual([VIDEO_IDS.b, VIDEO_IDS.a]);
      });
    });

    describe('listLibrary across owners', () => {
      beforeEach(async () => {
        const now = Date.now();
        const seed = (hoursAgo: number, input: Parameters<typeof publicVideo>[0]) =>
          subject.seedVideo(publicVideo(input), new Date(now - hoursAgo * HOUR_MS));
        await seed(1, { id: VIDEO_IDS.a, title: 'Beta 100% Cats', categoryId: CATEGORY_MUSIC_ID });
        await seed(2, { id: VIDEO_IDS.b, title: 'alpha cats', ownerId: OTHER_OWNER_ID });
        await seed(3, {
          id: VIDEO_IDS.c,
          title: 'Gamma',
          status: 'PROCESSING',
          visibility: 'private',
          ownerId: OTHER_OWNER_ID,
          categoryId: CATEGORY_GAMING_ID,
        });
        await seed(4, { id: VIDEO_IDS.d, title: 'Deleted cats', status: 'DELETED' });
      });

      const list = async (query: Partial<VideoLibraryQuery> = {}) =>
        idsOf(expectOk(await studio.listLibrary({ sort: 'newest', limit: 10, ...query })));

      it('lists every owner except deleted videos when no owner is given', async () => {
        expect(await list()).toEqual([VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]);
      });

      it.each([
        {
          sort: 'newest' as const,
          order: 'asc' as const,
          expected: [VIDEO_IDS.c, VIDEO_IDS.b, VIDEO_IDS.a],
        },
        {
          sort: 'title' as const,
          order: 'asc' as const,
          expected: [VIDEO_IDS.a, VIDEO_IDS.c, VIDEO_IDS.b],
        },
        {
          sort: 'title' as const,
          order: 'desc' as const,
          expected: [VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.a],
        },
      ])('orders by $sort $order', async ({ sort, order, expected }) => {
        expect(await list({ sort, order })).toEqual(expected);
      });

      it.each([
        { name: 'category', query: { categoryId: CATEGORY_GAMING_ID }, expected: [VIDEO_IDS.c] },
        {
          name: 'a title substring, ignoring case',
          query: { titleContains: 'CATS' },
          expected: [VIDEO_IDS.a, VIDEO_IDS.b],
        },
        {
          name: 'a literal percent sign',
          query: { titleContains: '100%' },
          expected: [VIDEO_IDS.a],
        },
        { name: 'a literal underscore', query: { titleContains: 'a_' }, expected: [] },
      ])('filters by $name', async ({ query, expected }) => {
        expect(await list(query)).toEqual(expected);
      });

      it('resumes an ascending title walk, uppercase before lowercase, without repeating', async () => {
        const firstPage = expectOk(
          await studio.listLibrary({ sort: 'title', order: 'asc', limit: 1 })
        );
        expect(idsOf(firstPage)).toEqual([VIDEO_IDS.a, VIDEO_IDS.c]);

        const [lastShown] = firstPage;
        if (!lastShown) throw new Error('the first page came back empty');
        const cursor = creatorLibraryCursorOf(lastShown, 'title');

        expect(await list({ sort: 'title', order: 'asc', cursor })).toEqual([
          VIDEO_IDS.c,
          VIDEO_IDS.b,
        ]);
      });
    });
  });
}

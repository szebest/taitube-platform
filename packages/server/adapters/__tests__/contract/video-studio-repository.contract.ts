import type { CreatorLibraryQuery, VideoStudioRepository } from '@vp/core/repositories';
import { type CreatorLibrarySort, creatorLibraryCursorOf } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  CATEGORY_GAMING_ID,
  CATEGORY_MUSIC_ID,
  HOUR_MS,
  OTHER_OWNER_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  publicVideo,
  seedCategories,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const UNKNOWN_CATEGORY_ID = '00000000-0000-7000-8000-000000000299';

export function describeVideoStudioRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoStudioRepository contract', () => {
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

    const versionOf = async (videoId: string) =>
      expectOk(await subject.repositories.videos.findById(videoId))?.version ?? -1;

    const eventTypesOf = async (videoId: string) =>
      expectOk(await subject.repositories.events.findByVideoId(videoId)).map((event) => event.type);

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

      const list = async (query: Partial<CreatorLibraryQuery> = {}) =>
        idsOf(
          expectOk(
            await studio.listLibrary({ ownerId: OWNER_ID, sort: 'newest', limit: 10, ...query })
          )
        );

      it.each<{ sort: CreatorLibrarySort; expected: string[] }>([
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

    describe('updateMetadata', () => {
      beforeEach(async () => {
        await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, title: 'Before' }));
      });

      const update = async (
        patch: Parameters<VideoStudioRepository['updateMetadata']>[0]['patch'],
        expectedVersion?: number
      ) =>
        studio.updateMetadata({
          videoId: VIDEO_IDS.a,
          expectedVersion: expectedVersion ?? (await versionOf(VIDEO_IDS.a)),
          patch,
          userId: OWNER_ID,
        });

      it('writes the studio fields, bumps the version and records the edit', async () => {
        const before = await versionOf(VIDEO_IDS.a);
        const outcome = expectOk(
          await update({
            title: 'After',
            tags: ['lofi', 'jazz'],
            categoryId: CATEGORY_MUSIC_ID,
            customThumbnailKey: `videos/${VIDEO_IDS.a}/thumbs/custom/t1.png`,
          })
        );

        expect(outcome).toMatchObject({
          type: 'updated',
          video: {
            title: 'After',
            tags: ['lofi', 'jazz'],
            categoryId: CATEGORY_MUSIC_ID,
            customThumbnailKey: `videos/${VIDEO_IDS.a}/thumbs/custom/t1.png`,
            version: before + 1,
          },
        });
        expect(await eventTypesOf(VIDEO_IDS.a)).toContain('video.metadata_updated');
      });

      it('clears a category and a custom thumbnail with null', async () => {
        expectOk(await update({ categoryId: CATEGORY_GAMING_ID, customThumbnailKey: 'k' }));

        const outcome = expectOk(await update({ categoryId: null, customThumbnailKey: null }));

        expect(outcome).toMatchObject({
          type: 'updated',
          video: { categoryId: null, customThumbnailKey: null },
        });
      });

      it('lets one of two edits carrying the same version win and refuses the other', async () => {
        const version = await versionOf(VIDEO_IDS.a);

        const [first, second] = await Promise.all([
          update({ title: 'First' }, version),
          update({ title: 'Second' }, version),
        ]);
        const winners = [first, second].filter((result) => result.ok);
        const losers = [first, second].filter((result) => !result.ok);

        expect(winners).toHaveLength(1);
        expect(losers.map((result) => expectErr(result).code)).toEqual([
          ErrorCodes.VERSION_CONFLICT,
        ]);
        expect(await versionOf(VIDEO_IDS.a)).toBe(version + 1);
      });

      it('answers video-missing for a video that is not there, not a conflict', async () => {
        const outcome = expectOk(
          await studio.updateMetadata({
            videoId: VIDEO_IDS.f,
            expectedVersion: 1,
            patch: { title: 'Ghost' },
            userId: OWNER_ID,
          })
        );

        expect(outcome).toEqual({ type: 'video-missing' });
      });

      it.each([
        { name: 'does not exist', categoryId: UNKNOWN_CATEGORY_ID, deactivate: false },
        { name: 'is inactive', categoryId: CATEGORY_GAMING_ID, deactivate: true },
      ])(
        'answers category-missing for a category that $name and writes nothing',
        async ({ categoryId, deactivate }) => {
          if (deactivate) {
            expectOk(await subject.repositories.categories.update(categoryId, { isActive: false }));
          }
          const before = await versionOf(VIDEO_IDS.a);

          const outcome = expectOk(await update({ title: 'Never', categoryId }));

          expect(outcome).toEqual({ type: 'category-missing', categoryId });
          expect(await versionOf(VIDEO_IDS.a)).toBe(before);
        }
      );
    });

    describe('takeDown', () => {
      beforeEach(async () => {
        await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      });

      it('rejects the video, hides it, bumps the version and records who and why', async () => {
        const before = await versionOf(VIDEO_IDS.a);

        const taken = expectOk(
          await studio.takeDown({
            videoId: VIDEO_IDS.a,
            from: ['READY'],
            moderatorId: OTHER_OWNER_ID,
            reason: 'Terms of service',
          })
        );

        expect(taken).toMatchObject({
          status: 'REJECTED',
          visibility: 'private',
          version: before + 1,
        });
        const events = expectOk(await subject.repositories.events.findByVideoId(VIDEO_IDS.a));
        expect(events.find((event) => event.type === 'video.taken_down')?.payload).toEqual({
          requestedBy: OTHER_OWNER_ID,
          reason: 'Terms of service',
        });
      });

      it('answers null and changes nothing when the video is not in a from status', async () => {
        const taken = expectOk(
          await studio.takeDown({ videoId: VIDEO_IDS.a, from: ['FAILED'], moderatorId: OWNER_ID })
        );

        expect(taken).toBeNull();
        expect(expectOk(await subject.repositories.videos.findById(VIDEO_IDS.a))?.status).toBe(
          'READY'
        );
      });

      it('makes an edit read before the takedown a version conflict', async () => {
        const readBefore = await versionOf(VIDEO_IDS.a);
        expectOk(
          await studio.takeDown({ videoId: VIDEO_IDS.a, from: ['READY'], moderatorId: OWNER_ID })
        );

        const failure = expectErr(
          await studio.updateMetadata({
            videoId: VIDEO_IDS.a,
            expectedVersion: readBefore,
            patch: { visibility: 'public' },
            userId: OWNER_ID,
          })
        );

        expect(failure.code).toBe(ErrorCodes.VERSION_CONFLICT);
      });
    });
  });
}

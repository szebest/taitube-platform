import type {
  ListPublicVideosOptions,
  VideoRecord,
  VideoRepository,
  VideoWithDetails,
} from '@vp/core/repositories';
import type { PublicFeedSort, VideoStatus } from '@vp/domain';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { Result } from '@vp/result';
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
import { SCAN_CASES, type ScanCase } from './video-scan-cases';

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

function cursorFor(video: VideoRecord, instant: number): ListPublicVideosOptions['cursor'] {
  return {
    id: video.id,
    createdAt: video.createdAt,
    viewsCount: video.viewsCount ?? 0,
    instant,
  };
}

export function describeVideoRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoRepository contract', () => {
    let subject: RepositoriesSubject;
    let videos: VideoRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      videos = subject.repositories.videos;
      await seedOwners(subject.repositories);
    });

    describe('create and read', () => {
      it('round-trips a created video through findById', async () => {
        const created = expectOk(
          await videos.create(
            publicVideo({ id: VIDEO_IDS.a, title: 'Round trip', status: 'UPLOADING' })
          )
        );
        const found = expectOk(await videos.findById(VIDEO_IDS.a));

        expect(found).not.toBeNull();
        expect(found?.ownerId).toBe(OWNER_ID);
        expect(found?.title).toBe('Round trip');
        expect(found?.status).toBe('UPLOADING');
        expect(found?.visibility).toBe('public');
        expect(found?.version).toBe(created.version);
      });

      it('exposes the video with its details', async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a })));
        const details = expectOk(await videos.findWithDetails(VIDEO_IDS.a));

        expect(details?.video.id).toBe(VIDEO_IDS.a);
        expect(details?.renditions).toEqual([]);
        expect(details?.steps).toEqual([]);
      });

      it.each<{
        name: string;
        read: (
          r: VideoRepository
        ) => Promise<Result<VideoRecord | VideoWithDetails | null, DatabaseUnavailable>>;
      }>([
        { name: 'findById', read: (r) => r.findById(VIDEO_IDS.f) },
        { name: 'findWithDetails', read: (r) => r.findWithDetails(VIDEO_IDS.f) },
      ])('answers ok(null) from $name for an unknown id', async ({ read }) => {
        expect(expectOk(await read(videos))).toBeNull();
      });
    });

    describe('listPublic', () => {
      /**
       * Trending decays against the wall clock, so a keyset cursor minted here and the rank
       * the repository recomputes only agree while both sample the same instant.
       */
      beforeEach(async () => {
        vi.spyOn(Date, 'now').mockReturnValue(FEED_INSTANT_MS);
        await seedCategories(subject.repositories);
        const now = Date.now();
        for (const seed of FEED_SEEDS) {
          await subject.seedVideo(
            publicVideo({
              id: seed.id,
              viewsCount: seed.viewsCount,
              categoryId: seed.categoryId,
            }),
            new Date(now - seed.ageHours * HOUR_MS)
          );
        }
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it.each<{ sort: PublicFeedSort }>([
        { sort: 'recent' },
        { sort: 'popular' },
        { sort: 'trending' },
      ])('orders the feed by $sort', async ({ sort }) => {
        const result = expectOk(await videos.listPublic({ limit: 10, sort }));

        expect(idsOf(result.items)).toEqual(EXPECTED_ORDER[sort]);
        expect(result.total).toBe(4);
      });

      it('defaults to the recent ordering when no sort is given', async () => {
        const result = expectOk(await videos.listPublic({ limit: 10 }));
        expect(idsOf(result.items)).toEqual(EXPECTED_ORDER.recent);
      });

      it.each<{ sort: PublicFeedSort; expected: string[] }>([
        { sort: 'recent', expected: [VIDEO_IDS.a, VIDEO_IDS.c] },
        { sort: 'popular', expected: [VIDEO_IDS.c, VIDEO_IDS.a] },
        { sort: 'trending', expected: [VIDEO_IDS.c, VIDEO_IDS.a] },
      ])('restricts $sort to the requested category', async ({ sort, expected }) => {
        const result = expectOk(
          await videos.listPublic({
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
        expectOk(await videos.create(publicVideo(input)));
        const result = expectOk(await videos.listPublic({ limit: 10 }));

        expect(idsOf(result.items)).not.toContain(VIDEO_IDS.e);
        expect(result.total).toBe(4);
      });

      it('over-fetches one row so the caller can detect a next page', async () => {
        const result = expectOk(await videos.listPublic({ limit: 2 }));

        expect(idsOf(result.items)).toEqual([VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]);
        expect(result.total).toBe(4);
      });

      it.each<{ sort: PublicFeedSort }>([
        { sort: 'recent' },
        { sort: 'popular' },
        { sort: 'trending' },
      ])('resumes the $sort feed from a keyset cursor', async ({ sort }) => {
        const firstPage = expectOk(await videos.listPublic({ limit: 1, sort }));
        const last = firstPage.items[0] as VideoRecord;

        const secondPage = expectOk(
          await videos.listPublic({
            limit: 10,
            sort,
            cursor: cursorFor(last, firstPage.instant),
          })
        );

        expect(idsOf(secondPage.items)).toEqual(EXPECTED_ORDER[sort].slice(1));
        expect(secondPage.total).toBe(4);
      });

      it.each<{ sort: PublicFeedSort }>([
        { sort: 'recent' },
        { sort: 'popular' },
        { sort: 'trending' },
      ])('walks the whole $sort feed one row per page without repeating', async ({ sort }) => {
        const walked: string[] = [];
        let cursor: ListPublicVideosOptions['cursor'];

        for (let page = 0; page <= FEED_SEEDS.length; page += 1) {
          const result = expectOk(await videos.listPublic({ limit: 1, sort, cursor }));
          const row = result.items[0];
          if (!row) break;
          walked.push(row.id);
          if (result.items.length === 1) break;
          cursor = cursorFor(row, result.instant);
        }

        expect(walked).toEqual(EXPECTED_ORDER[sort]);
      });

      it('returns an empty page for a category with no public videos', async () => {
        expectOk(
          await videos.create(
            publicVideo({ id: VIDEO_IDS.e, visibility: 'private', categoryId: null })
          )
        );
        const result = expectOk(
          await videos.listPublic({
            limit: 10,
            categoryId: '00000000-0000-7000-8000-0000000002ff',
          })
        );

        expect(result.items).toEqual([]);
        expect(result.total).toBe(0);
      });
    });

    describe('listByOwner', () => {
      beforeEach(async () => {
        const now = Date.now();
        await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }), new Date(now - 1 * HOUR_MS));
        await subject.seedVideo(
          publicVideo({ id: VIDEO_IDS.b, status: 'PROCESSING' }),
          new Date(now - 2 * HOUR_MS)
        );
        await subject.seedVideo(
          publicVideo({ id: VIDEO_IDS.c, ownerId: OTHER_OWNER_ID }),
          new Date(now - 3 * HOUR_MS)
        );
      });

      it.each<{ scenario: string; status?: VideoStatus; expected: string[] }>([
        {
          scenario: 'returns only the owner rows, newest first',
          expected: [VIDEO_IDS.a, VIDEO_IDS.b],
        },
        { scenario: 'filters by status', status: 'PROCESSING', expected: [VIDEO_IDS.b] },
      ])('$scenario', async ({ status, expected }) => {
        const rows = expectOk(await videos.listByOwner({ ownerId: OWNER_ID, limit: 10, status }));
        expect(idsOf(rows)).toEqual(expected);
      });
    });

    describe('state transitions', () => {
      beforeEach(async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })));
      });

      const completeUpload = () =>
        videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'UPLOADING',
          to: 'UPLOADED',
          eventType: 'upload.completed',
        });

      it('commits a transition once and refuses the stale repeat', async () => {
        expect(expectOk(await completeUpload())).toBe(true);
        expect(expectOk(await completeUpload())).toBe(false);

        expect(expectOk(await videos.findById(VIDEO_IDS.a))?.status).toBe('UPLOADED');
      });

      it('appends exactly one event per committed transition', async () => {
        await completeUpload();
        await completeUpload();

        const events = await subject.repositories.events.findByVideoId(VIDEO_IDS.a);
        expect(events.filter((e) => e.type === 'upload.completed')).toHaveLength(1);
      });

      it('accepts any of the allowed source states', async () => {
        expect(
          expectOk(
            await videos.transition({
              videoId: VIDEO_IDS.a,
              from: ['UPLOADED', 'UPLOADING'],
              to: 'PROBING',
              eventType: 'video.probing',
            })
          )
        ).toBe(true);
      });
    });

    describe('updateMetadata', () => {
      it('bumps the version and reports a stale one as VERSION_CONFLICT', async () => {
        const { version } = expectOk(
          await videos.create(publicVideo({ id: VIDEO_IDS.a, title: 'Before' }))
        );

        const updated = expectOk(
          await videos.updateMetadata({
            videoId: VIDEO_IDS.a,
            expectedVersion: version,
            patch: { title: 'After' },
          })
        );

        expect(updated?.title).toBe('After');
        expect(updated?.version).toBe(version + 1);

        const failure = expectErr(
          await videos.updateMetadata({
            videoId: VIDEO_IDS.a,
            expectedVersion: version,
            patch: { title: 'Stale' },
          })
        );

        expect(failure.code).toBe(ErrorCodes.VERSION_CONFLICT);
      });

      it('answers ok(null) for a video that is not there, not a version conflict', async () => {
        expect(
          expectOk(
            await videos.updateMetadata({
              videoId: VIDEO_IDS.f,
              expectedVersion: 1,
              patch: { title: 'Ghost' },
            })
          )
        ).toBeNull();
      });
    });

    describe('counters', () => {
      it('counts videos by status', async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'READY' })));
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'READY' })));
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.c, status: 'PROCESSING' })));

        expect(expectOk(await videos.countByStatus())).toMatchObject({ READY: 2, PROCESSING: 1 });
      });

      it('counts only the in-flight videos of one owner', async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'PROCESSING' })));
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'PROBING' })));
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.c, status: 'READY' })));
        expectOk(
          await videos.create(
            publicVideo({ id: VIDEO_IDS.d, ownerId: OTHER_OWNER_ID, status: 'PROCESSING' })
          )
        );

        expect(expectOk(await videos.countInFlightByOwner(OWNER_ID))).toBe(2);
      });

      it('persists reaction counters', async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a })));
        expectOk(await videos.updateReactionCounters(VIDEO_IDS.a, 7, 2));

        const found = expectOk(await videos.findById(VIDEO_IDS.a));
        expect(found?.likesCount).toBe(7);
        expect(found?.dislikesCount).toBe(2);
      });
    });

    describe('housekeeping scans', () => {
      it.each<ScanCase>(SCAN_CASES)('$scenario', async ({ seed, filter }) => {
        await seed(subject.repositories);
        expect(idsOf(expectOk(await videos.scan(filter)))).toEqual([VIDEO_IDS.a]);
      });

      it('leaves rows alone until they have been idle for the whole threshold', async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })));
        expect(
          expectOk(
            await videos.scan({
              status: 'UPLOADING',
              idleFor: { since: 'updatedAt', ms: HOUR_MS },
            })
          )
        ).toEqual([]);
      });

      it('returns no more rows than the limit', async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })));
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'UPLOADING' })));
        expect(expectOk(await videos.scan({ status: 'UPLOADING', limit: 1 }))).toHaveLength(1);
      });

      it('hard-deletes only a soft-deleted video', async () => {
        expectOk(await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'READY' })));
        expect(expectOk(await videos.hardDelete(VIDEO_IDS.a))).toBe(false);

        expectOk(
          await videos.transition({
            videoId: VIDEO_IDS.a,
            from: 'READY',
            to: 'DELETED',
            eventType: 'video.deleted',
          })
        );

        expect(expectOk(await videos.hardDelete(VIDEO_IDS.a))).toBe(true);
        expect(expectOk(await videos.findById(VIDEO_IDS.a))).toBeNull();
      });
    });
  });
}

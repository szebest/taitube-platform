import {
  type ListPublicVideosOptions,
  type PublicFeedSort,
  type VideoRecord,
  type VideoRepository,
  publicFeedInstant,
  publicFeedRanking,
} from '@vp/core/ports';
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

interface FeedSeed {
  id: string;
  ageHours: number;
  viewsCount: number;
  categoryId: string;
}

const FEED_SEEDS: FeedSeed[] = [
  { id: VIDEO_IDS.a, ageHours: 1, viewsCount: 10, categoryId: CATEGORY_MUSIC_ID },
  { id: VIDEO_IDS.b, ageHours: 5, viewsCount: 500, categoryId: CATEGORY_GAMING_ID },
  { id: VIDEO_IDS.c, ageHours: 50, viewsCount: 5000, categoryId: CATEGORY_MUSIC_ID },
  { id: VIDEO_IDS.d, ageHours: 100, viewsCount: 1, categoryId: CATEGORY_GAMING_ID },
];

const EXPECTED_ORDER: Record<PublicFeedSort, string[]> = {
  recent: [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d],
  popular: [VIDEO_IDS.c, VIDEO_IDS.b, VIDEO_IDS.a, VIDEO_IDS.d],
  trending: [VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.a, VIDEO_IDS.d],
};

function cursorFor(sort: PublicFeedSort, video: VideoRecord): ListPublicVideosOptions['cursor'] {
  const ranking = publicFeedRanking(sort);
  if (ranking.cursorField === 'viewsCount') {
    return { id: video.id, viewsCount: video.viewsCount ?? 0 };
  }
  if (ranking.cursorField === 'score') {
    return { id: video.id, score: ranking.rankOf(video, publicFeedInstant()) };
  }
  return { id: video.id, createdAt: video.createdAt };
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
        const created = await videos.create(
          publicVideo({ id: VIDEO_IDS.a, title: 'Round trip', status: 'UPLOADING' })
        );
        const found = await videos.findById(VIDEO_IDS.a);

        expect(found).not.toBeNull();
        expect(found?.ownerId).toBe(OWNER_ID);
        expect(found?.title).toBe('Round trip');
        expect(found?.status).toBe('UPLOADING');
        expect(found?.visibility).toBe('public');
        expect(found?.version).toBe(created.version);
      });

      it('returns null for an unknown id', async () => {
        expect(await videos.findById(VIDEO_IDS.f)).toBeNull();
      });

      it('exposes the video with its details', async () => {
        await videos.create(publicVideo({ id: VIDEO_IDS.a }));
        const details = await videos.findWithDetails(VIDEO_IDS.a);

        expect(details?.video.id).toBe(VIDEO_IDS.a);
        expect(details?.renditions).toEqual([]);
        expect(details?.steps).toEqual([]);
        expect(await videos.findWithDetails(VIDEO_IDS.f)).toBeNull();
      });
    });

    describe('listPublic', () => {
      beforeEach(async () => {
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

      it.each<{ sort: PublicFeedSort }>([
        { sort: 'recent' },
        { sort: 'popular' },
        { sort: 'trending' },
      ])('orders the feed by $sort', async ({ sort }) => {
        const result = await videos.listPublic({ limit: 10, sort });

        expect(idsOf(result.items)).toEqual(EXPECTED_ORDER[sort]);
        expect(result.total).toBe(4);
      });

      it('defaults to the recent ordering when no sort is given', async () => {
        const result = await videos.listPublic({ limit: 10 });
        expect(idsOf(result.items)).toEqual(EXPECTED_ORDER.recent);
      });

      it.each<{ sort: PublicFeedSort; expected: string[] }>([
        { sort: 'recent', expected: [VIDEO_IDS.a, VIDEO_IDS.c] },
        { sort: 'popular', expected: [VIDEO_IDS.c, VIDEO_IDS.a] },
        { sort: 'trending', expected: [VIDEO_IDS.c, VIDEO_IDS.a] },
      ])('restricts $sort to the requested category', async ({ sort, expected }) => {
        const result = await videos.listPublic({
          limit: 10,
          sort,
          categoryId: CATEGORY_MUSIC_ID,
        });

        expect(idsOf(result.items)).toEqual(expected);
        expect(result.total).toBe(2);
      });

      it.each<{ scenario: string; input: Parameters<typeof publicVideo>[0] }>([
        { scenario: 'private videos', input: { id: VIDEO_IDS.e, visibility: 'private' } },
        { scenario: 'unlisted videos', input: { id: VIDEO_IDS.e, visibility: 'unlisted' } },
        { scenario: 'videos that are not READY', input: { id: VIDEO_IDS.e, status: 'PROCESSING' } },
        { scenario: 'soft-deleted videos', input: { id: VIDEO_IDS.e, deletedAt: new Date() } },
      ])('excludes $scenario from both the page and the total', async ({ input }) => {
        await videos.create(publicVideo(input));
        const result = await videos.listPublic({ limit: 10 });

        expect(idsOf(result.items)).not.toContain(VIDEO_IDS.e);
        expect(result.total).toBe(4);
      });

      it('over-fetches one row so the caller can detect a next page', async () => {
        const result = await videos.listPublic({ limit: 2 });

        expect(idsOf(result.items)).toEqual([VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]);
        expect(result.total).toBe(4);
      });

      it.each<{ sort: PublicFeedSort }>([
        { sort: 'recent' },
        { sort: 'popular' },
        { sort: 'trending' },
      ])('resumes the $sort feed from a keyset cursor', async ({ sort }) => {
        const firstPage = await videos.listPublic({ limit: 1, sort });
        const last = firstPage.items[0] as VideoRecord;

        const secondPage = await videos.listPublic({
          limit: 10,
          sort,
          cursor: cursorFor(sort, last),
        });

        expect(idsOf(secondPage.items)).toEqual(EXPECTED_ORDER[sort].slice(1));
        expect(secondPage.total).toBe(4);
      });

      it('returns an empty page for a category with no public videos', async () => {
        await videos.create(
          publicVideo({ id: VIDEO_IDS.e, visibility: 'private', categoryId: null })
        );
        const result = await videos.listPublic({
          limit: 10,
          categoryId: '00000000-0000-7000-8000-0000000002ff',
        });

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

      it('returns only the owner rows, newest first', async () => {
        const rows = await videos.listByOwner({ ownerId: OWNER_ID, limit: 10 });
        expect(idsOf(rows)).toEqual([VIDEO_IDS.a, VIDEO_IDS.b]);
      });

      it('filters by status', async () => {
        const rows = await videos.listByOwner({
          ownerId: OWNER_ID,
          limit: 10,
          status: 'PROCESSING',
        });
        expect(idsOf(rows)).toEqual([VIDEO_IDS.b]);
      });
    });

    describe('state transitions', () => {
      beforeEach(async () => {
        await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' }));
      });

      it('commits a transition once and refuses the stale repeat', async () => {
        expect(
          await videos.transition({
            videoId: VIDEO_IDS.a,
            from: 'UPLOADING',
            to: 'UPLOADED',
            eventType: 'upload.completed',
          })
        ).toBe(true);

        expect(
          await videos.transition({
            videoId: VIDEO_IDS.a,
            from: 'UPLOADING',
            to: 'UPLOADED',
            eventType: 'upload.completed',
          })
        ).toBe(false);

        expect((await videos.findById(VIDEO_IDS.a))?.status).toBe('UPLOADED');
      });

      it('appends exactly one event per committed transition', async () => {
        await videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'UPLOADING',
          to: 'UPLOADED',
          eventType: 'upload.completed',
        });
        await videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'UPLOADING',
          to: 'UPLOADED',
          eventType: 'upload.completed',
        });

        const events = await subject.repositories.events.findByVideoId(VIDEO_IDS.a);
        expect(events.filter((e) => e.type === 'upload.completed')).toHaveLength(1);
      });

      it('accepts any of the allowed source states', async () => {
        expect(
          await videos.transition({
            videoId: VIDEO_IDS.a,
            from: ['UPLOADED', 'UPLOADING'],
            to: 'PROBING',
            eventType: 'video.probing',
          })
        ).toBe(true);
      });
    });

    describe('updateMetadata', () => {
      it('bumps the version and rejects a stale one', async () => {
        const { version } = await videos.create(publicVideo({ id: VIDEO_IDS.a, title: 'Before' }));

        const updated = await videos.updateMetadata({
          videoId: VIDEO_IDS.a,
          expectedVersion: version,
          patch: { title: 'After' },
        });

        expect(updated.title).toBe('After');
        expect(updated.version).toBe(version + 1);

        await expect(
          videos.updateMetadata({
            videoId: VIDEO_IDS.a,
            expectedVersion: version,
            patch: { title: 'Stale' },
          })
        ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
      });
    });

    describe('counters', () => {
      it('counts videos by status', async () => {
        await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'READY' }));
        await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'READY' }));
        await videos.create(publicVideo({ id: VIDEO_IDS.c, status: 'PROCESSING' }));

        expect(await videos.countByStatus()).toMatchObject({ READY: 2, PROCESSING: 1 });
      });

      it('counts only the in-flight videos of one owner', async () => {
        await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'PROCESSING' }));
        await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'PROBING' }));
        await videos.create(publicVideo({ id: VIDEO_IDS.c, status: 'READY' }));
        await videos.create(
          publicVideo({ id: VIDEO_IDS.d, ownerId: OTHER_OWNER_ID, status: 'PROCESSING' })
        );

        expect(await videos.countInFlightByOwner(OWNER_ID)).toBe(2);
      });

      it('persists reaction counters', async () => {
        await videos.create(publicVideo({ id: VIDEO_IDS.a }));
        await videos.updateReactionCounters(VIDEO_IDS.a, 7, 2);

        const found = await videos.findById(VIDEO_IDS.a);
        expect(found?.likesCount).toBe(7);
        expect(found?.dislikesCount).toBe(2);
      });
    });

    describe('housekeeping scans', () => {
      it('finds videos stuck in UPLOADING past the threshold', async () => {
        await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' }));
        expect(idsOf(await videos.findStaleUploading(-1))).toEqual([VIDEO_IDS.a]);
        expect(await videos.findStaleUploading(HOUR_MS)).toEqual([]);
      });

      it('hard-deletes only a soft-deleted video', async () => {
        await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'READY' }));
        expect(await videos.hardDelete(VIDEO_IDS.a)).toBe(false);

        await videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'READY',
          to: 'DELETED',
          eventType: 'video.deleted',
        });

        expect(await videos.hardDelete(VIDEO_IDS.a)).toBe(true);
        expect(await videos.findById(VIDEO_IDS.a)).toBeNull();
      });
    });
  });
}

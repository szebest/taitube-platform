import type { VideoRecord, VideoRepository, VideoWithDetails } from '@vp/core/repositories';
import type { VideoStatus } from '@vp/domain';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  HOUR_MS,
  OTHER_OWNER_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  publicVideo,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import type { VideoContractContext } from './video-contract-context';
import { describeVideoFeedContract } from './video-feed.contract';
import { describeVideoLifecycleContract } from './video-lifecycle.contract';

export function describeVideoRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoRepository contract', () => {
    let subject: RepositoriesSubject;
    let videos: VideoRepository;
    const ctx: VideoContractContext = {
      get subject() {
        return subject;
      },
      get videos() {
        return videos;
      },
    };

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

    describeVideoFeedContract(ctx);
    describeVideoLifecycleContract(ctx);
  });
}

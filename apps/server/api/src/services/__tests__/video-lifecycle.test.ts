import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { VideoStatus } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { VideoService } from '../video-service';
import { videoServiceDeps } from './service-deps';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000c1';
const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000c2', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000c3', role: 'USER' };
const ADMIN: UserContext = { id: '00000000-0000-7000-8000-0000000000c4', role: 'ADMIN' };

describe('apps/api/services: video lifecycle', () => {
  let repositories: InMemoryRepositories;
  let probeQueue: InMemoryJobQueue;
  let service: VideoService;

  async function seed(status: VideoStatus = 'READY'): Promise<void> {
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        title: 'Reprocess fixture',
        visibility: 'public',
        status,
        sourceKey: 'raw/reprocess.mp4',
      })
    );
  }

  const storedVideo = async () => expectOk(await repositories.videos.findById(VIDEO_ID));

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    probeQueue = new InMemoryJobQueue('probe');
    service = new VideoService(videoServiceDeps(repositories.videos, { probeQueue }));
  });

  describe('reprocess', () => {
    it('bumps the generation, transitions to PROBING and enqueues the probe', async () => {
      await seed();

      const result = expectOk(await service.reprocess(OWNER, VIDEO_ID));

      expect(result).toEqual({ videoId: VIDEO_ID, status: 'PROBING', generation: 2 });
      expect(await storedVideo()).toMatchObject({ status: 'PROBING', generation: 2 });

      const jobs = expectOk(await probeQueue.getJobs(['waiting', 'delayed', 'active']));
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.opts?.jobId).toBe(ids.probe(VIDEO_ID, 2));
    });

    it('clears the previous failure so a retried video stops reporting a stale error', async () => {
      await seed('FAILED');
      expectOk(
        await repositories.videos.transition({
          videoId: VIDEO_ID,
          from: 'FAILED',
          to: 'FAILED',
          eventType: 'video.failed',
          patch: { errorCode: 'CORRUPT_CONTAINER', errorMessage: 'boom' },
        })
      );

      expectOk(await service.reprocess(OWNER, VIDEO_ID));

      expect(await storedVideo()).toMatchObject({ errorCode: null, errorMessage: null });
    });

    it('records the reprocess request as a video event', async () => {
      await seed();

      expectOk(await service.reprocess(OWNER, VIDEO_ID));

      const events = expectOk(await repositories.events.findByVideoId(VIDEO_ID));
      expect(events.find((event) => event.type === 'video.reprocessing')?.payload).toMatchObject({
        generation: 2,
        requestedBy: OWNER.id,
      });
    });

    it('lets an admin reprocess a video they do not own', async () => {
      await seed();

      expect(expectOk(await service.reprocess(ADMIN, VIDEO_ID))).toMatchObject({
        status: 'PROBING',
      });
    });

    it('returns a forbidden failure for a caller who is neither owner nor admin', async () => {
      await seed();

      expect(expectErr(await service.reprocess(STRANGER, VIDEO_ID)).code).toBe(
        ErrorCodes.FORBIDDEN
      );
      expect(expectOk(await probeQueue.getJobs(['waiting', 'delayed', 'active']))).toHaveLength(0);
    });

    it.each<VideoStatus>(['UPLOADING', 'UPLOADED', 'PROBING', 'DELETED'])(
      'returns a validation failure when reprocessing from %s',
      async (status) => {
        await seed(status);

        expect(expectErr(await service.reprocess(OWNER, VIDEO_ID)).code).toBe(
          ErrorCodes.VALIDATION_FAILED
        );
      }
    );

    it('returns a not-found failure for an unknown video', async () => {
      expect(expectErr(await service.reprocess(OWNER, VIDEO_ID)).code).toBe(
        ErrorCodes.VIDEO_NOT_FOUND
      );
    });
  });

  describe('softDelete', () => {
    it('marks the video DELETED, stamps deletedAt and stays idempotent', async () => {
      await seed();

      expect(expectOk(await service.softDelete(OWNER, VIDEO_ID))).toEqual({
        videoId: VIDEO_ID,
        status: 'DELETED',
      });
      expect(await storedVideo()).toMatchObject({
        status: 'DELETED',
        deletedAt: expect.any(Date),
      });
      expect(expectOk(await service.softDelete(OWNER, VIDEO_ID))).toEqual({
        videoId: VIDEO_ID,
        status: 'DELETED',
      });
    });

    it('returns a forbidden failure for a caller who is neither owner nor admin', async () => {
      await seed();

      expect(expectErr(await service.softDelete(STRANGER, VIDEO_ID))).toMatchObject({
        code: ErrorCodes.FORBIDDEN,
        action: 'delete',
        subject: 'Video',
        userId: STRANGER.id,
      });
    });
  });
});

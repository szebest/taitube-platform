import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters';
import type { VideoStatus } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import type { AuthUser } from '../../plugins/auth';
import { VideoService } from '../video-service';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000c1';
const OWNER: AuthUser = { id: '00000000-0000-7000-8000-0000000000c2', role: 'USER' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-0000000000c3', role: 'USER' };
const ADMIN: AuthUser = { id: '00000000-0000-7000-8000-0000000000c4', role: 'ADMIN' };

describe('apps/api/services: video lifecycle', () => {
  let repositories: InMemoryRepositories;
  let probeQueue: InMemoryJobQueue;
  let service: VideoService;

  async function seed(status: VideoStatus = 'READY'): Promise<void> {
    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      title: 'Reprocess fixture',
      visibility: 'public',
      status,
      sourceKey: 'raw/reprocess.mp4',
    });
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    probeQueue = new InMemoryJobQueue('probe');
    service = new VideoService({
      videos: repositories.videos,
      cdnBaseUrl: 'http://localhost:9000/public',
      probeQueue,
    });
  });

  describe('reprocess', () => {
    it('bumps the generation, transitions to PROBING and enqueues the probe', async () => {
      await seed();

      const result = await service.reprocess(OWNER, VIDEO_ID);

      expect(result).toEqual({ videoId: VIDEO_ID, status: 'PROBING', generation: 2 });
      await expect(repositories.videos.findById(VIDEO_ID)).resolves.toMatchObject({
        status: 'PROBING',
        generation: 2,
      });

      const jobs = await probeQueue.getJobs(['waiting', 'delayed', 'active']);
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.opts?.jobId).toBe(ids.probe(VIDEO_ID, 2));
    });

    it('clears the previous failure so a retried video stops reporting a stale error', async () => {
      await seed('FAILED');
      await repositories.videos.transition({
        videoId: VIDEO_ID,
        from: 'FAILED',
        to: 'FAILED',
        eventType: 'video.failed',
        patch: { errorCode: 'PROBE_FAILED', errorMessage: 'boom' },
      });

      await service.reprocess(OWNER, VIDEO_ID);

      await expect(repositories.videos.findById(VIDEO_ID)).resolves.toMatchObject({
        errorCode: null,
        errorMessage: null,
      });
    });

    it('records the reprocess request as a video event', async () => {
      await seed();

      await service.reprocess(OWNER, VIDEO_ID);

      const events = await repositories.events.findByVideoId(VIDEO_ID);
      expect(events.find((event) => event.type === 'video.reprocessing')?.payload).toMatchObject({
        generation: 2,
        requestedBy: OWNER.id,
      });
    });

    it('lets an admin reprocess a video they do not own', async () => {
      await seed();

      await expect(service.reprocess(ADMIN, VIDEO_ID)).resolves.toMatchObject({
        status: 'PROBING',
      });
    });

    it('refuses a caller who is neither owner nor admin', async () => {
      await seed();

      await expect(service.reprocess(STRANGER, VIDEO_ID)).rejects.toMatchObject({
        code: ErrorCodes.FORBIDDEN,
      });
      expect(await probeQueue.getJobs(['waiting', 'delayed', 'active'])).toHaveLength(0);
    });

    it.each<VideoStatus>(['UPLOADING', 'UPLOADED', 'PROBING', 'DELETED'])(
      'refuses to reprocess from %s',
      async (status) => {
        await seed(status);

        await expect(service.reprocess(OWNER, VIDEO_ID)).rejects.toMatchObject({
          code: ErrorCodes.VALIDATION_FAILED,
        });
      }
    );

    it('reports an unknown video as not found', async () => {
      await expect(service.reprocess(OWNER, VIDEO_ID)).rejects.toMatchObject({
        code: ErrorCodes.VIDEO_NOT_FOUND,
      });
    });
  });

  describe('softDelete', () => {
    it('marks the video DELETED, stamps deletedAt and stays idempotent', async () => {
      await seed();

      await expect(service.softDelete(OWNER, VIDEO_ID)).resolves.toEqual({
        videoId: VIDEO_ID,
        status: 'DELETED',
      });
      await expect(repositories.videos.findById(VIDEO_ID)).resolves.toMatchObject({
        status: 'DELETED',
        deletedAt: expect.any(Date),
      });
      await expect(service.softDelete(OWNER, VIDEO_ID)).resolves.toEqual({
        videoId: VIDEO_ID,
        status: 'DELETED',
      });
    });

    it('refuses a caller who is neither owner nor admin', async () => {
      await seed();

      await expect(service.softDelete(STRANGER, VIDEO_ID)).rejects.toThrow(
        'Only the video owner or an admin may delete this video'
      );
    });
  });
});

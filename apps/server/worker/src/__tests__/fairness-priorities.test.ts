import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
} from '@vp/adapters/in-memory';
import { ids } from '@vp/job-contracts';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runReconcileUploads } from '../stages/housekeeping/reconcile-uploads';
import { STAGE_SETTINGS, TASKS } from './stage-settings';

describe('fairness under admission control (SDD §9.4, §14.2)', () => {
  it('a pro user with 5 videos reaches READY before a free user with 50 finishes', async () => {
    const repositories = new InMemoryRepositories();
    const multipart = new InMemoryMultipartStorage();
    const probeQueue = new InMemoryJobQueue('probe');
    const transcodeQueue = new InMemoryJobQueue('transcode-720p');
    const packageQueue = new InMemoryJobQueue('package');

    const MAX_INFLIGHT = 3;

    const FREE_USER_ID = SEEDED.otherUserId;
    const PRO_USER_ID = SEEDED.userId;
    const TOTAL_VIDEOS = 55;

    const readyOwners: string[] = [];
    const { promise: allReady, resolve: markAllReady } = Promise.withResolvers<void>();

    async function triggerReconciler() {
      await runReconcileUploads({
        ...TASKS.uploads,
        ...STAGE_SETTINGS,
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: MAX_INFLIGHT,
      });
    }

    await probeQueue.process(async (job) => {
      const { videoId } = job.data as { videoId: string };
      const video = expectOk(await repositories.videos.findById(videoId));
      if (!video) return;

      await repositories.videos.transition({
        videoId,
        from: 'UPLOADED',
        to: 'PROBING',
        eventType: 'probe.started',
      });

      await repositories.steps.claim({
        id: uuidv7(),
        videoId,
        step: 'probe',
        rendition: '-',
        jobId: job.id,
        attempt: 1,
        workerId: 'worker-probe',
        lockToken: uuidv7(),
      });

      await repositories.videos.transition({
        videoId,
        from: 'PROBING',
        to: 'PROCESSING',
        eventType: 'probe.completed',
      });

      await transcodeQueue.add(
        'transcode-720p',
        { videoId, generation: 1 },
        { jobId: ids.transcode(videoId, '720p', 1), priority: job.opts?.priority }
      );
    });

    await transcodeQueue.process(async (job) => {
      const { videoId } = job.data as { videoId: string };
      await packageQueue.add(
        'package',
        { videoId, generation: 1 },
        { jobId: ids.package(videoId, 1), priority: job.opts?.priority }
      );
    });

    await packageQueue.process(async (job) => {
      const { videoId } = job.data as { videoId: string };
      const video = expectOk(await repositories.videos.findById(videoId));
      if (!video) return;

      await repositories.videos.transition({
        videoId,
        from: 'PROCESSING',
        to: 'READY',
        eventType: 'video.ready',
      });

      readyOwners.push(video.ownerId);
      if (readyOwners.length === TOTAL_VIDEOS) markAllReady();

      await triggerReconciler();
    });

    async function submitUpload(ownerId: string, index: number, priority: number) {
      const videoId = uuidv7();
      const sourceKey = `raw/${videoId}/source.mp4`;

      const video = expectOk(
        await repositories.videos.create({
          id: videoId,
          ownerId,
          title: `video-${index}`,
          status: 'UPLOADED',
          sourceKey,
          sourceSizeBytes: 1000,
        })
      );
      video.updatedAt = new Date(Date.now() - 5000);

      const inFlight = expectOk(await repositories.videos.countInFlightByOwner(ownerId));
      if (inFlight < MAX_INFLIGHT) {
        await probeQueue.add(
          'probe',
          { videoId, sourceKey, generation: 1 },
          { jobId: ids.probe(videoId, 1), priority }
        );
      }
    }

    for (let i = 1; i <= 50; i++) {
      await submitUpload(FREE_USER_ID, i, 5);
    }

    for (let i = 1; i <= 5; i++) {
      await submitUpload(PRO_USER_ID, i, 1);
    }
    await allReady;

    expect(readyOwners.filter((owner) => owner === FREE_USER_ID)).toHaveLength(50);
    expect(readyOwners.filter((owner) => owner === PRO_USER_ID)).toHaveLength(5);
    expect(readyOwners.lastIndexOf(PRO_USER_ID)).toBeLessThan(
      readyOwners.lastIndexOf(FREE_USER_ID)
    );
  });
});

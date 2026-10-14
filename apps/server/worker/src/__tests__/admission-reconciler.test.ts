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

const FREE_USER_ID = SEEDED.otherUserId;
const PRO_USER_ID = SEEDED.userId;
const FREE_PRIORITY = 5;
const PRO_PRIORITY = 1;

describe('admission control in the uploads reconciler', () => {
  let repositories: InMemoryRepositories;
  let multipart: InMemoryMultipartStorage;
  let probeQueue: InMemoryJobQueue;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    multipart = new InMemoryMultipartStorage();
    probeQueue = new InMemoryJobQueue('probe');
  });

  async function createVideo(
    ownerId: string,
    status: 'UPLOADED' | 'PROBING' | 'PROCESSING' | 'READY'
  ) {
    const videoId = uuidv7();
    const video = expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId,
        title: `video-${videoId}`,
        status,
        sourceKey: `raw/${videoId}/source.mp4`,
        sourceSizeBytes: 1000,
      })
    );
    // A zero-threshold scan only matches rows whose clock is already in the past.
    video.updatedAt = new Date(Date.now() - 5000);
    return video;
  }

  async function reconcile() {
    return expectOk(
      await runReconcileUploads({
        ...TASKS.uploads,
        ...STAGE_SETTINGS,
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: 3,
      })
    );
  }

  it('keeps an UPLOADED video held while its owner is at the in-flight cap', async () => {
    await createVideo(FREE_USER_ID, 'PROBING');
    await createVideo(FREE_USER_ID, 'PROCESSING');
    await createVideo(FREE_USER_ID, 'PROCESSING');
    const heldVideo = await createVideo(FREE_USER_ID, 'UPLOADED');

    const result = await reconcile();

    expect(result.reenqueuedCount).toBe(0);
    expect(probeQueue.enqueuedJobs).toHaveLength(0);
    const heldDb = expectOk(await repositories.videos.findById(heldVideo.id));
    expect(heldDb?.status).toBe('UPLOADED');
  });

  it('releases held videos one free slot at a time with the tier priority', async () => {
    await createVideo(FREE_USER_ID, 'PROBING');
    await createVideo(FREE_USER_ID, 'PROCESSING');
    const held1 = await createVideo(FREE_USER_ID, 'UPLOADED');
    await createVideo(FREE_USER_ID, 'UPLOADED');

    const result = await reconcile();

    expect(result.reenqueuedCount).toBe(1);
    expect(probeQueue.enqueuedJobs).toHaveLength(1);
    const releasedJob = probeQueue.enqueuedJobs[0];
    if (!releasedJob) {
      throw new Error('Expected releasedJob to be present');
    }
    expect(releasedJob.id).toBe(ids.probe(held1.id, 1));
    expect(releasedJob.opts?.priority).toBe(FREE_PRIORITY);

    await repositories.steps.claim({
      id: uuidv7(),
      videoId: held1.id,
      step: 'probe',
      rendition: '-',
      jobId: releasedJob.id,
      attempt: 1,
      workerId: 'worker-1',
      lockToken: 'token-1',
    });
    await repositories.videos.transition({
      videoId: held1.id,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
    });

    expect((await reconcile()).reenqueuedCount).toBe(0);

    const activeVideo = expectOk(
      await repositories.videos.scan({ status: 'PROCESSING', limit: 1 })
    )[0];
    if (!activeVideo) {
      throw new Error('Expected a PROCESSING video');
    }
    await repositories.videos.transition({
      videoId: activeVideo.id,
      from: 'PROCESSING',
      to: 'READY',
      eventType: 'video.ready',
    });

    expect((await reconcile()).reenqueuedCount).toBe(1);
    expect(probeQueue.enqueuedJobs).toHaveLength(2);
  });

  it('releases a pro user video with the pro priority', async () => {
    await createVideo(PRO_USER_ID, 'UPLOADED');

    const result = await reconcile();

    expect(result.reenqueuedCount).toBe(1);
    expect(probeQueue.enqueuedJobs).toHaveLength(1);
    expect(probeQueue.enqueuedJobs[0]?.opts?.priority).toBe(PRO_PRIORITY);
  });

  it('runs a pro job next behind a backlog of 20 free jobs on one worker', async () => {
    const queue = new InMemoryJobQueue('test-priority-queue');
    const executionOrder: string[] = [];

    await queue.pause();
    for (let i = 1; i <= 20; i++) {
      await queue.add(
        'test-job',
        { index: i, user: 'free' },
        { jobId: `free-${i}`, priority: FREE_PRIORITY }
      );
    }

    const { promise: firstJobStarted, resolve: resolveFirstJob } = Promise.withResolvers<void>();
    const { promise: holdFirstJob, resolve: continueFirstJob } = Promise.withResolvers<void>();
    const { promise: allDone, resolve: markAllDone } = Promise.withResolvers<void>();
    queue.onJobCompleted(() => {
      if (executionOrder.length === 21) markAllDone();
    });

    await queue.process(async (job) => {
      executionOrder.push(job.id);
      if (job.id === 'free-1') {
        resolveFirstJob();
        await holdFirstJob;
      }
    });

    await queue.resume();
    await firstJobStarted;
    await queue.add('test-job', { user: 'pro' }, { jobId: 'pro-job', priority: PRO_PRIORITY });
    continueFirstJob();
    await allDone;

    expect(executionOrder[0]).toBe('free-1');
    expect(executionOrder[1]).toBe('pro-job');
    expect(executionOrder).toHaveLength(21);
    expect(executionOrder.slice(2)).toEqual(Array.from({ length: 19 }, (_, i) => `free-${i + 2}`));
  });
});

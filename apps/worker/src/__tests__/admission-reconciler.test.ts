import { InMemoryJobQueue, InMemoryMultipartStorage, InMemoryRepositories } from '@vp/adapters';
import { ids } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runReconcileUploads } from '../stages/housekeeping/reconcile-uploads';

describe('apps/worker Admission Control Reconciler & Priorities (Ticket 18: AC 2, AC 3)', () => {
  let repositories: InMemoryRepositories;
  let multipart: InMemoryMultipartStorage;
  let probeQueue: InMemoryJobQueue;

  const FREE_USER_ID = '00000000-0000-7000-8000-000000000002'; // tier: free
  const PRO_USER_ID = '00000000-0000-7000-8000-000000000001'; // tier: pro

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

  it('AC 2: Reconciler does not release held UPLOADED video if owner in-flight >= MAX_INFLIGHT_PER_USER', async () => {
    // 3 in-flight videos for free user
    await createVideo(FREE_USER_ID, 'PROBING');
    await createVideo(FREE_USER_ID, 'PROCESSING');
    await createVideo(FREE_USER_ID, 'PROCESSING');

    // 1 held video in UPLOADED without probe step
    const heldVideo = await createVideo(FREE_USER_ID, 'UPLOADED');

    // Run reconciler with 0 threshold override (simulating cadence trigger)
    const result = expectOk(
      await runReconcileUploads({
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: 3,
      })
    );

    // Inflight is 3 >= 3, so video remains held
    expect(result.reenqueuedCount).toBe(0);
    expect(probeQueue.enqueuedJobs).toHaveLength(0);

    const heldDb = expectOk(await repositories.videos.findById(heldVideo.id));
    expect(heldDb?.status).toBe('UPLOADED');
  });

  it('AC 2: Reconciler releases held UPLOADED video when owner in-flight < MAX_INFLIGHT_PER_USER with tier priority', async () => {
    // 2 in-flight videos for free user (1 slot available)
    await createVideo(FREE_USER_ID, 'PROBING');
    await createVideo(FREE_USER_ID, 'PROCESSING');

    // 2 held videos in UPLOADED
    const held1 = await createVideo(FREE_USER_ID, 'UPLOADED');
    await createVideo(FREE_USER_ID, 'UPLOADED');

    // Run reconciler with 0 threshold override
    const result = expectOk(
      await runReconcileUploads({
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: 3,
      })
    );

    // Exactly 1 video released (reaches the max 3 in-flight)
    expect(result.reenqueuedCount).toBe(1);
    expect(probeQueue.enqueuedJobs).toHaveLength(1);

    const releasedJob = probeQueue.enqueuedJobs[0];
    if (!releasedJob) {
      throw new Error('Expected releasedJob to be present');
    }
    expect(releasedJob.id).toBe(ids.probe(held1.id, 1));
    expect(releasedJob.opts?.priority).toBe(5); // free tier priority

    // Simulate probe step claimed and video transitioning to PROBING
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

    // Second run: owner now has 3 in-flight (2 existing + held1), so held2 remains held
    const result2 = expectOk(
      await runReconcileUploads({
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: 3,
      })
    );
    expect(result2.reenqueuedCount).toBe(0);

    // Now complete one video (PROBING -> READY)
    const activeVideo = expectOk(await repositories.videos.scan({ status: 'PROCESSING' }))[0];
    if (activeVideo) {
      await repositories.videos.transition({
        videoId: activeVideo.id,
        from: 'PROCESSING',
        to: 'READY',
        eventType: 'video.ready',
      });
    }

    // Now in-flight is 2 (< 3), run reconciler again: held2 is released!
    const result3 = expectOk(
      await runReconcileUploads({
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: 3,
      })
    );
    expect(result3.reenqueuedCount).toBe(1);
    expect(probeQueue.enqueuedJobs).toHaveLength(2);
  });

  it('AC 2: Reconciler releases held video for pro user with priority 1', async () => {
    await createVideo(PRO_USER_ID, 'UPLOADED');

    const result = expectOk(
      await runReconcileUploads({
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: 3,
      })
    );

    expect(result.reenqueuedCount).toBe(1);
    expect(probeQueue.enqueuedJobs).toHaveLength(1);
    expect(probeQueue.enqueuedJobs[0]?.opts?.priority).toBe(1); // pro tier priority
  });

  it('AC 3: With a backlog of 20 free jobs and 1 worker, a newly added pro job runs next', async () => {
    const queue = new InMemoryJobQueue('test-priority-queue');
    const executionOrder: string[] = [];

    // Pause queue to simulate building up a backlog
    await queue.pause();

    // Enqueue 20 free jobs with priority 5
    for (let i = 1; i <= 20; i++) {
      await queue.add('test-job', { index: i, user: 'free' }, { jobId: `free-${i}`, priority: 5 });
    }

    let resolveFirstJob: () => void = () => {};
    const firstJobStarted = new Promise<void>((r) => {
      resolveFirstJob = r;
    });

    let continueFirstJob: () => void = () => {};
    const holdFirstJob = new Promise<void>((r) => {
      continueFirstJob = r;
    });

    const allDone = new Promise<void>((resolve) => {
      queue.onJobCompleted(() => {
        if (executionOrder.length === 21) {
          resolve();
        }
      });
    });

    // Start worker processor
    await queue.process(async (job) => {
      executionOrder.push(job.id);

      if (job.id === 'free-1') {
        // Signal that the first job has started
        resolveFirstJob?.();
        // Wait until pro job has been enqueued
        await holdFirstJob;
      }
    });

    // Resume queue to let the first job start executing
    await queue.resume();
    await firstJobStarted;

    // While free-1 is currently running and free-2..free-20 are waiting in backlog,
    // a pro job arrives with priority 1:
    await queue.add('test-job', { user: 'pro' }, { jobId: 'pro-job', priority: 1 });

    // Allow free-1 to complete
    continueFirstJob?.();

    // Wait for all 21 jobs in the queue to finish
    await allDone;

    // Verify execution order:
    // 1st was free-1 (already running when pro arrived)
    // 2nd MUST be pro-job (jumps ahead of free-2..free-20 due to priority 1 vs 5)
    // 3rd..21st are free-2..free-20
    expect(executionOrder[0]).toBe('free-1');
    expect(executionOrder[1]).toBe('pro-job');
    expect(executionOrder).toHaveLength(21);
    expect(executionOrder.slice(2)).toEqual(Array.from({ length: 19 }, (_, i) => `free-${i + 2}`));
  });
});

import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
} from '@vp/adapters/in-memory';
import { ids } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { describe, expect, it } from 'vitest';
import { runReconcileUploads } from '../stages/housekeeping/reconcile-uploads';
import { STAGE_SETTINGS } from './stage-settings';

describe('Fairness & Admission Control Simulation (Ticket 18: AC 4, SDD §9.4, §14.2)', () => {
  it('User B (5 videos, pro tier) reaches READY before User A (50 videos, free tier) finishes', async () => {
    const repositories = new InMemoryRepositories();
    const multipart = new InMemoryMultipartStorage();
    const probeQueue = new InMemoryJobQueue('probe');
    const transcodeQueue = new InMemoryJobQueue('transcode-720p');
    const packageQueue = new InMemoryJobQueue('package');

    const MAX_INFLIGHT = 3;

    const USER_A_ID = '00000000-0000-7000-8000-000000000002'; // free tier
    const USER_B_ID = '00000000-0000-7000-8000-000000000001'; // pro tier

    const userAReadyTimes: number[] = [];
    const userBReadyTimes: number[] = [];

    const startTime = Date.now();

    // Helper to simulate reconciler release whenever a video reaches READY
    async function triggerReconciler() {
      await runReconcileUploads({
        ...STAGE_SETTINGS,
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 0,
        maxInflightPerUser: MAX_INFLIGHT,
      });
    }

    // Set up workers for pipeline stages
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

      // Forward to transcode with same priority
      await transcodeQueue.add(
        'transcode-720p',
        { videoId, generation: 1 },
        { jobId: ids.transcode(videoId, '720p', 1), priority: job.opts?.priority }
      );
    });

    await transcodeQueue.process(async (job) => {
      const { videoId } = job.data as { videoId: string };
      // Simulate encoding work
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

      const finishTime = Date.now() - startTime;
      if (video.ownerId === USER_A_ID) {
        userAReadyTimes.push(finishTime);
      } else if (video.ownerId === USER_B_ID) {
        userBReadyTimes.push(finishTime);
      }

      // Reconciler releases the next held upload for this user if available
      await triggerReconciler();
    });

    // Function to submit an upload for a user
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
      // Set updatedAt in past so reconciler can detect it if held
      video.updatedAt = new Date(Date.now() - 5000);

      const inFlight = expectOk(await repositories.videos.countInFlightByOwner(ownerId));
      if (inFlight < MAX_INFLIGHT) {
        // Admitted immediately
        await probeQueue.add(
          'probe',
          { videoId, sourceKey, generation: 1 },
          { jobId: ids.probe(videoId, 1), priority }
        );
      }
      // If inFlight >= MAX_INFLIGHT, video remains held in UPLOADED
      return videoId;
    }

    // 1. User A submits 50 videos (free user, priority 5)
    for (let i = 1; i <= 50; i++) {
      await submitUpload(USER_A_ID, i, 5);
    }

    // 2. User B submits 5 videos (pro user, priority 1)
    for (let i = 1; i <= 5; i++) {
      await submitUpload(USER_B_ID, i, 1);
    }

    // Wait until all 55 videos reach READY
    const maxWaitMs = 15000;
    const pollStart = Date.now();
    while (userAReadyTimes.length < 50 || userBReadyTimes.length < 5) {
      if (Date.now() - pollStart > maxWaitMs) {
        throw new Error(
          `Timeout waiting for all videos to finish. User A: ${userAReadyTimes.length}/50, User B: ${userBReadyTimes.length}/5`
        );
      }
      // Trigger reconciler to process any remaining held videos
      await triggerReconciler();
      await new Promise((r) => setTimeout(r, 20));
    }

    // Verify all 55 videos reached READY
    expect(userAReadyTimes).toHaveLength(50);
    expect(userBReadyTimes).toHaveLength(5);

    const userBLastReadyTime = userBReadyTimes[4] ?? 0;
    const userALastReadyTime = userAReadyTimes[49] ?? 0;

    // Count how many of User A's videos finished when User B finished
    const userAFinishedCountWhenBCompleted = userAReadyTimes.filter(
      (t) => t <= userBLastReadyTime
    ).length;

    // Output documented timings (AC 4 requirement)
    console.log('\n--- TICKET 18 FAIRNESS SIMULATION REPORT ---');
    console.log(`User A (free, 50 videos): total finish time = ${userALastReadyTime}ms`);
    console.log(`User B (pro,   5 videos): total finish time = ${userBLastReadyTime}ms`);
    console.log(
      `When User B completed all 5 videos (${userBLastReadyTime}ms), User A had only completed ${userAFinishedCountWhenBCompleted}/50 videos.`
    );
    console.log(
      `User B's 5th video finished BEFORE User A's 50th video: ${userBLastReadyTime < userALastReadyTime}`
    );
    console.log('--------------------------------------------\n');

    // Assertions:
    // User B's 5 videos must reach READY before User A's 50 finish
    expect(userBLastReadyTime).toBeLessThan(userALastReadyTime);
    // User A should still have videos pending when User B finishes
    expect(userAFinishedCountWhenBCompleted).toBeLessThan(50);
  });
});

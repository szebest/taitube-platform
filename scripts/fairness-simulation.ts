/**
 * Fairness simulation (SDD §9.4, §14.2).
 *
 * Demonstrates per-user admission control and tier-based queue priorities:
 * - User A (free tier) submits 50 videos with priority 5
 * - User B (pro tier) submits 5 videos with priority 1
 * - MAX_INFLIGHT_PER_USER = 3 prevents User A from monopolizing pipeline workers
 * - User B's videos reach READY before User A's 50 videos finish
 *
 * Usage:
 *   pnpm tsx scripts/fairness-simulation.ts
 *   bun scripts/fairness-simulation.ts
 */

import * as crypto from 'node:crypto';
import { runReconcileUploads } from '../apps/worker/src/stages/housekeeping/reconcile-uploads';
import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
} from '../packages/server/adapters/index';
import { ids } from '../packages/server/job-contracts/src/index';
import { createMetricsRegistry } from '../packages/server/observability/src/index';
import { rawSourceKey } from '../packages/server/storage/src/index';
import { isErr } from '../packages/universal/result/src/index';

async function runFairnessSimulation() {
  console.log('================================================================');
  console.log('VIDEO-PIPELINE: Admission Control & Fairness Benchmark');
  console.log('================================================================');

  const repositories = new InMemoryRepositories();
  const multipart = new InMemoryMultipartStorage();
  const probeQueue = new InMemoryJobQueue('probe');
  const transcodeQueue = new InMemoryJobQueue('transcode-720p');
  const packageQueue = new InMemoryJobQueue('package');

  const MAX_INFLIGHT = 3;
  const USER_A_ID = '00000000-0000-7000-8000-000000000002'; // free user
  const USER_B_ID = '00000000-0000-7000-8000-000000000001'; // pro user

  const userAReadyTimes: { index: number; elapsedMs: number }[] = [];
  const userBReadyTimes: { index: number; elapsedMs: number }[] = [];

  const startHrTime = process.hrtime.bigint();
  const getElapsedMs = () => Number((process.hrtime.bigint() - startHrTime) / 1000000n);

  const metrics = createMetricsRegistry();

  async function triggerReconciler() {
    const reconciled = await runReconcileUploads({
      rawBucket: 'raw',
      repositories,
      multipart,
      probeQueue,
      metrics,
      uploadingThresholdMs: Number.MAX_SAFE_INTEGER,
      uploadedThresholdMs: 0,
      maxInflightPerUser: MAX_INFLIGHT,
    });
    if (isErr(reconciled)) throw new Error(`reconciler failed: ${reconciled.error.message}`);
  }

  // Worker stages simulation
  await probeQueue.process(async (job) => {
    const { videoId } = job.data as { videoId: string };
    await repositories.videos.transition({
      videoId,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
    });

    await repositories.steps.claim({
      id: crypto.randomUUID(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: job.id,
      attempt: 1,
      workerId: 'worker-probe',
      lockToken: crypto.randomUUID(),
    });

    await repositories.videos.transition({
      videoId,
      from: 'PROBING',
      to: 'PROCESSING',
      eventType: 'probe.completed',
    });

    // Small simulated work
    await new Promise((r) => setTimeout(r, 2));

    await transcodeQueue.add(
      'transcode-720p',
      { videoId, generation: 1 },
      { jobId: ids.transcode(videoId, '720p', 1), priority: job.opts?.priority }
    );
  });

  await transcodeQueue.process(async (job) => {
    const { videoId } = job.data as { videoId: string };
    // Small simulated transcode work
    await new Promise((r) => setTimeout(r, 5));

    await packageQueue.add(
      'package',
      { videoId, generation: 1 },
      { jobId: ids.package(videoId, 1), priority: job.opts?.priority }
    );
  });

  await packageQueue.process(async (job) => {
    const { videoId } = job.data as { videoId: string };
    const video = await repositories.videos.findById(videoId);
    if (!video) return;

    await repositories.videos.transition({
      videoId,
      from: 'PROCESSING',
      to: 'READY',
      eventType: 'video.ready',
    });

    const elapsedMs = getElapsedMs();
    if (video.ownerId === USER_A_ID) {
      userAReadyTimes.push({ index: userAReadyTimes.length + 1, elapsedMs });
    } else if (video.ownerId === USER_B_ID) {
      userBReadyTimes.push({ index: userBReadyTimes.length + 1, elapsedMs });
    }

    // Immediately trigger reconciler on completion of in-flight video
    await triggerReconciler();
  });

  async function submitUpload(ownerId: string, index: number, priority: number) {
    const videoId = crypto.randomUUID();
    const sourceKey = rawSourceKey(videoId);

    const video = await repositories.videos.create({
      id: videoId,
      ownerId,
      title: `video-${index}`,
      status: 'UPLOADED',
      sourceKey,
      sourceSizeBytes: 1000,
    });
    video.updatedAt = new Date(Date.now() - 5000);

    const inFlight = await repositories.videos.countInFlightByOwner(ownerId);
    if (inFlight < MAX_INFLIGHT) {
      await probeQueue.add(
        'probe',
        { videoId, sourceKey, generation: 1 },
        { jobId: ids.probe(videoId, 1), priority }
      );
    }
    return videoId;
  }

  console.log('[1/3] Submitting 50 uploads for User A (free tier, priority 5)...');
  for (let i = 1; i <= 50; i++) {
    await submitUpload(USER_A_ID, i, 5);
  }

  console.log('[2/3] Submitting 5 uploads for User B (pro tier, priority 1)...');
  for (let i = 1; i <= 5; i++) {
    await submitUpload(USER_B_ID, i, 1);
  }

  console.log('[3/3] Processing pipeline jobs with admission control and priority scheduling...');
  const maxWaitMs = 30000;
  const pollStart = Date.now();
  while (userAReadyTimes.length < 50 || userBReadyTimes.length < 5) {
    if (Date.now() - pollStart > maxWaitMs) {
      throw new Error(
        `Timeout waiting for simulation: User A (${userAReadyTimes.length}/50), User B (${userBReadyTimes.length}/5)`
      );
    }
    await triggerReconciler();
    await new Promise((r) => setTimeout(r, 20));
  }

  const userBLast = userBReadyTimes[4] ?? { index: 5, elapsedMs: 0 };
  const userALast = userAReadyTimes[49] ?? { index: 50, elapsedMs: 0 };
  const userAAtBCompletion = userAReadyTimes.filter(
    (t) => t.elapsedMs <= userBLast.elapsedMs
  ).length;

  console.log('\n================== SIMULATION RESULTS ==================');
  console.log(`MAX_INFLIGHT_PER_USER:               ${MAX_INFLIGHT}`);
  console.log(`User B (Pro, 5 videos) finished in:  ${userBLast.elapsedMs.toFixed(2)} ms`);
  console.log(`User A (Free, 50 videos) finished in: ${userALast.elapsedMs.toFixed(2)} ms`);
  console.log(`User A progress when User B finished: ${userAAtBCompletion} / 50 videos`);
  console.log(
    `Fairness assertion verified:         ${userBLast.elapsedMs < userALast.elapsedMs ? 'PASSED ✓' : 'FAILED ✗'}`
  );
  console.log('========================================================\n');
}

runFairnessSimulation().catch((err) => {
  console.error('Fairness simulation failed:', err);
  process.exit(1);
});

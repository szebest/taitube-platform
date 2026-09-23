import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { FlowProducerPort, JobQueue, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  type QueueUnavailable,
  type StorageUnavailable,
  mediaFailure,
  mediaFailureFrom,
} from '@vp/errors';
import { type ProbeMetadata, runFfprobe } from '@vp/ffmpeg';
import type { ProbeJob } from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import { type Result, err, fromPromise, isErr, ok, unwrapOr } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { getHeartbeatPath } from '../config';

import { validateJobId } from '../registry';
import { enqueueFollowUpJobs } from './probe-enqueue';
import { recordProbeFailure } from './probe-failure';

export interface ProbeProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket?: string;
  workerId?: string;
  logger: Logger;
  heartbeatPath?: string;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
}

export interface ProbeStageResult {
  videoId: string;
  status: string;
  durationMs: number;
}

export type ProbeStageFailure =
  | MediaFailure
  | DatabaseUnavailable
  | StorageUnavailable
  | QueueUnavailable
  | CacheUnavailable;

const PRIORITY_PAID = 1;
const PRIORITY_FREE = 5;

/** A tier lookup that cannot answer costs the job its priority, not its place in the queue. */
async function probePriority(repositories: Repositories, videoId: string): Promise<number> {
  if (!repositories.users) return PRIORITY_FREE;

  const video = unwrapOr(await repositories.videos.findById(videoId), null);
  if (!video?.ownerId) return PRIORITY_FREE;

  const owner = unwrapOr(await repositories.users.findById(video.ownerId), null);
  return owner?.tier === 'pro' || owner?.tier === 'enterprise' ? PRIORITY_PAID : PRIORITY_FREE;
}

export function createProbeProcessor(deps: ProbeProcessorDeps) {
  const {
    repositories,
    storage,
    rawBucket = process.env['S3_BUCKET_RAW'] || 'raw',
    workerId = `worker-${process.pid}`,
    logger,
    heartbeatPath = getHeartbeatPath(),
    getQueue,
    flowProducer,
  } = deps;

  return async function processProbeJob(
    job: QueueJob<ProbeJob>
  ): Promise<Result<ProbeStageResult, ProbeStageFailure>> {
    // 1. Validate Job ID (AC 22)
    validateJobId(job.id || '');

    const { videoId, sourceKey } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      attempt: (job.attemptsMade ?? 0) + 1,
      stage: 'probe',
    });

    log.info({ sourceKey }, 'Probe job started');

    // Update heartbeat file for container liveness (SDD §9.4, AC 20)
    await fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});

    // 2. CAS Transition: UPLOADED -> PROBING (AC 17)
    const startedResult = await repositories.videos.transition({
      videoId,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
      eventPayload: { jobId: job.id, attempt: (job.attemptsMade ?? 0) + 1 },
    });
    if (isErr(startedResult)) return startedResult;

    if (!startedResult.value) {
      // Check current video state
      const currentResult = await repositories.videos.findById(videoId);
      if (isErr(currentResult)) return currentResult;
      const current = currentResult.value;
      if (current && ['PROCESSING', 'READY', 'FAILED', 'DELETED'].includes(current.status)) {
        log.info(
          { status: current.status },
          'Video already past PROBING; skipping redundant execution'
        );
        return ok({
          videoId,
          status: current.status,
          durationMs: current.durationMs || 0,
        });
      }
    }

    // 3. Claim processing step with fresh fencing token (SDD §5.3, §9.5, AC 20)
    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: job.id || '',
      attempt: (job.attemptsMade ?? 0) + 1,
      workerId,
      lockToken,
    });

    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'Probe step already completed; fenced out');
      return ok({ videoId, status: 'DONE', durationMs: 0 });
    }

    // Heartbeat update on processing_steps (AC 20)
    const beat = await repositories.steps.heartbeat(lockToken);
    if (isErr(beat)) return beat;

    // 4. Per-job temp directory with guaranteed cleanup on every exit path (AC 21)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vp-probe-${videoId}-`));

    /** One place decides how a probe ends: record it, then report the media verdict upward. */
    const failProbe = async (failure: MediaFailure): Promise<Result<never, ProbeStageFailure>> => {
      const recorded = await recordProbeFailure(
        { repositories, job, lockToken, getQueue },
        failure.code,
        failure.message
      );
      return isErr(recorded) ? recorded : err(failure);
    };

    try {
      // 5. Verify source in S3 (AC 19)
      const head = await storage.headObject(rawBucket, sourceKey);
      if (isErr(head)) return head;
      if (!head.value) {
        log.error({ sourceKey }, 'Source object not found in storage');
        return await failProbe(
          mediaFailure(
            'probe',
            ErrorCodes.SOURCE_MISSING,
            `Source object not found in storage at ${sourceKey}`
          )
        );
      }

      // Download source to local file for ffprobe analysis
      const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
      const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);
      if (isErr(downloaded)) return downloaded;

      if (!downloaded.value) {
        log.error({ sourceKey }, 'Failed to download source object');
        return await failProbe(
          mediaFailure(
            'probe',
            ErrorCodes.SOURCE_MISSING,
            `Failed to download source object from ${sourceKey}`
          )
        );
      }

      if (head.value.contentLength) {
        getMetrics().workerTmpBytes.set({ stage: 'probe' }, head.value.contentLength);
      }

      // 6. Run ffprobe and validate media (AC 17, AC 18). `@vp/ffmpeg` spawns a process and still
      // throws, so this is the line that converts it.
      const probed = await fromPromise(
        () => runFfprobe(localSourcePath),
        (cause) => mediaFailureFrom('probe', cause, ErrorCodes.CORRUPT_CONTAINER)
      );

      if (isErr(probed)) {
        getMetrics().ffmpegExitTotal.inc({ stage: 'probe', code: probed.error.code });
        log.warn(
          { errorCode: probed.error.code, err: probed.error.message },
          'Probe validation failed with permanent error'
        );
        return await failProbe(probed.error);
      }

      getMetrics().ffmpegExitTotal.inc({ stage: 'probe', code: '0' });
      const metadata: ProbeMetadata = probed.value;

      log.info(
        {
          durationMs: metadata.durationMs,
          ladder: metadata.ladder.map((r) => r.name),
          dimensions: `${metadata.effectiveWidth}x${metadata.effectiveHeight}`,
        },
        'Probe successful, updating database and pending renditions'
      );

      // 7. Insert pending renditions rows for each ladder entry (AC 17)
      for (const entry of metadata.ladder) {
        const created = await repositories.renditions.create({
          id: uuidv7(),
          videoId,
          name: entry.name,
          width: entry.width,
          height: entry.height,
          videoBitrateKbps: entry.videoKbps,
          audioBitrateKbps: entry.audioKbps,
          status: 'PENDING',
        });
        if (isErr(created)) return created;
      }

      // 8. Complete step with fencing token check (AC 20)
      const comp = await repositories.steps.complete({
        videoId,
        step: 'probe',
        rendition: '-',
        lockToken,
        result: {
          durationMs: metadata.durationMs,
          ladder: metadata.ladder.map((r) => r.name),
          width: metadata.effectiveWidth,
          height: metadata.effectiveHeight,
          fps: metadata.fps,
        },
      });

      if (isErr(comp)) return comp;

      if (comp.value.fenced) {
        log.warn({ lockToken }, 'Fenced out on step completion (another worker reclaimed step)');
        return ok({
          videoId,
          status: 'FENCED',
          durationMs: metadata.durationMs,
        });
      }

      // 9. CAS transition: PROBING -> PROCESSING with metadata patch (AC 17)
      const committed = await repositories.videos.transition({
        videoId,
        from: 'PROBING',
        to: 'PROCESSING',
        eventType: 'probe.completed',
        eventPayload: {
          durationMs: metadata.durationMs,
          ladder: metadata.ladder.map((r) => r.name),
        },
        patch: {
          durationMs: metadata.durationMs,
          width: metadata.effectiveWidth,
          height: metadata.effectiveHeight,
          fps: metadata.fps,
          ladder: metadata.ladder,
        },
      });
      if (isErr(committed)) return committed;

      // 10. Enqueue fan-out / fan-in Flow (SDD §3.2, §9.3, Ticket 12)
      const enqueued = await enqueueFollowUpJobs({
        job,
        metadata,
        priority: job.opts?.priority ?? (await probePriority(repositories, videoId)),
        flowProducer,
        getQueue,
        log,
      });
      if (isErr(enqueued)) return enqueued;

      return ok({
        videoId,
        status: 'PROCESSING',
        durationMs: metadata.durationMs,
      });
    } finally {
      // Guaranteed temp directory removal on every exit path (AC 21)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      getMetrics().workerTmpBytes.set({ stage: 'probe' }, 0);
    }
  };
}

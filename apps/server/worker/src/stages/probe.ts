import * as path from 'node:path';
import type { FlowProducerPort, JobQueue, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories, UserRecord } from '@vp/core/repositories';
import { jobPriorityFor } from '@vp/domain';
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
import type { MediaTools, ProbeMetadata } from '@vp/ffmpeg';
import type { ProbeJob } from '@vp/job-contracts';
import type { PipelineMetrics } from '@vp/observability';
import type { Logger } from '@vp/logger';
import { type Result, err, fromPromise, isErr, ok, unwrapOr } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { enqueueFollowUpJobs } from './probe-enqueue';
import { recordProbeFailure } from './probe-failure';
import { createScratchDir, removeScratchDir } from './scratch-dir';

export interface ProbeProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  metrics: PipelineMetrics;
  rawBucket: string;
  workerId: string;
  logger: Logger;
  tmpDir: string;
  ffprobePath: string;
  maxDurationSeconds: number;
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

async function ownerTier(
  repositories: Repositories,
  videoId: string
): Promise<UserRecord['tier'] | undefined> {
  const video = unwrapOr(await repositories.videos.findById(videoId), null);
  if (!video?.ownerId) return undefined;

  return unwrapOr(await repositories.users.findById(video.ownerId), null)?.tier;
}

export function createProbeProcessor(deps: ProbeProcessorDeps) {
  const {
    repositories,
    storage,
    media,
    metrics,
    rawBucket,
    workerId,
    logger,
    tmpDir: tmpRoot,
    ffprobePath,
    maxDurationSeconds,
    getQueue,
    flowProducer,
  } = deps;

  return async function processProbeJob(
    job: QueueJob<ProbeJob>
  ): Promise<Result<ProbeStageResult, ProbeStageFailure>> {
    const { videoId, sourceKey } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      attempt: (job.attemptsMade ?? 0) + 1,
      stage: 'probe',
    });

    log.info({ sourceKey }, 'probe job started');

    const startedResult = await repositories.videos.transition({
      videoId,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
      eventPayload: { jobId: job.id, attempt: (job.attemptsMade ?? 0) + 1 },
    });
    if (isErr(startedResult)) return startedResult;

    if (!startedResult.value) {
      const currentResult = await repositories.videos.findById(videoId);
      if (isErr(currentResult)) return currentResult;
      const current = currentResult.value;
      if (current && ['PROCESSING', 'READY', 'FAILED', 'DELETED'].includes(current.status)) {
        log.info(
          { status: current.status },
          'video already past PROBING; skipping redundant execution'
        );
        return ok({
          videoId,
          status: current.status,
          durationMs: current.durationMs || 0,
        });
      }
    }

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
      log.warn({ lockToken }, 'probe step already completed; fenced out');
      return ok({ videoId, status: 'DONE', durationMs: 0 });
    }

    const beat = await repositories.steps.heartbeat(lockToken);
    if (isErr(beat)) return beat;

    const tmpDir = await createScratchDir(tmpRoot, `vp-probe-${videoId}-`);

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
      const head = await storage.headObject(rawBucket, sourceKey);
      if (isErr(head)) return head;
      if (!head.value) {
        log.error({ sourceKey }, 'source object not found in storage');
        return await failProbe(
          mediaFailure(
            'probe',
            ErrorCodes.SOURCE_MISSING,
            `Source object not found in storage at ${sourceKey}`
          )
        );
      }

      const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
      const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);
      if (isErr(downloaded)) return downloaded;

      if (!downloaded.value) {
        log.error({ sourceKey }, 'failed to download source object');
        return await failProbe(
          mediaFailure(
            'probe',
            ErrorCodes.SOURCE_MISSING,
            `Failed to download source object from ${sourceKey}`
          )
        );
      }

      if (head.value.contentLength) {
        metrics.workerTmpBytes.set({ stage: 'probe' }, head.value.contentLength);
      }

      const probed = await fromPromise(
        () => media.probe(localSourcePath, { ffprobePath, maxDurationSec: maxDurationSeconds }),
        (cause) => mediaFailureFrom('probe', cause, ErrorCodes.CORRUPT_CONTAINER)
      );

      if (isErr(probed)) {
        metrics.ffmpegExitTotal.inc({ stage: 'probe', code: probed.error.code });
        log.warn(
          { err: probed.error },
          'probe validation failed with permanent error'
        );
        return await failProbe(probed.error);
      }

      metrics.ffmpegExitTotal.inc({ stage: 'probe', code: '0' });
      const metadata: ProbeMetadata = probed.value;

      log.info(
        {
          durationMs: metadata.durationMs,
          ladder: metadata.ladder.map((r) => r.name),
          dimensions: `${metadata.effectiveWidth}x${metadata.effectiveHeight}`,
        },
        'probe successful, updating database and pending renditions'
      );

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
        log.warn({ lockToken }, 'fenced out on step completion (another worker reclaimed step)');
        return ok({
          videoId,
          status: 'FENCED',
          durationMs: metadata.durationMs,
        });
      }

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

      const enqueued = await enqueueFollowUpJobs({
        job,
        metadata,
        priority: job.opts?.priority ?? jobPriorityFor(await ownerTier(repositories, videoId)),
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
      await removeScratchDir(tmpDir);
      metrics.workerTmpBytes.set({ stage: 'probe' }, 0);
    }
  };
}

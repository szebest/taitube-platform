import type { JobQueue } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { QueueName } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface ReconcileProcessingOptions {
  repositories: Repositories;
  getQueue: (name: QueueName) => JobQueue;
  thresholdMs: number;
  workerId: string;
  logger?: Logger;
}

export interface ReconcileProcessingResult {
  orphanedCount: number;
}

const ACTIVE_PROCESSING_QUEUES: QueueName[] = [
  'probe',
  'transcode-1080p',
  'transcode-720p',
  'transcode-480p',
  'thumbnail',
  'package',
];

/**
 * Fails a video left PROCESSING past the threshold with no RUNNING step and no job waiting in any
 * processing queue, as `ORPHANED`, and parks a DLQ entry for it (SDD §9.8).
 */
export async function runReconcileProcessing(
  options: ReconcileProcessingOptions
): Promise<Result<ReconcileProcessingResult, DatabaseUnavailable>> {
  const { repositories, getQueue, thresholdMs, workerId, logger } = options;

  let orphanedCount = 0;

  const staleProcessing = await repositories.videos.scan({
    status: 'PROCESSING',
    idleFor: { since: 'updatedAt', ms: thresholdMs },
  });
  if (isErr(staleProcessing)) return staleProcessing;

  for (const video of staleProcessing.value) {
    const steps = await repositories.steps.findByVideoId(video.id);
    if (isErr(steps)) return steps;
    if (steps.value.some((s) => s.status === 'RUNNING')) {
      continue;
    }

    // A queue that cannot be inspected is assumed to still hold the job, which errs on the side of
    // leaving a live video alone rather than failing it.
    let hasWaitingJob = false;
    for (const queueName of ACTIVE_PROCESSING_QUEUES) {
      const jobs = await getQueue(queueName).getJobs([
        'waiting',
        'active',
        'delayed',
        'prioritized',
      ]);
      if (isErr(jobs)) {
        hasWaitingJob = true;
        break;
      }

      hasWaitingJob = jobs.value.some((j) => {
        const data = j.data as { videoId?: string } | undefined;
        return data?.videoId === video.id || j.id.startsWith(video.id);
      });
      if (hasWaitingJob) break;
    }

    if (hasWaitingJob) {
      continue;
    }

    const transitioned = await repositories.videos.transition({
      videoId: video.id,
      from: 'PROCESSING',
      to: 'FAILED',
      eventType: 'video.failed',
      eventPayload: { code: ErrorCodes.ORPHANED, message: 'Processing orphaned' },
      patch: {
        errorCode: ErrorCodes.ORPHANED,
        errorMessage: 'Processing timed out with no active steps or waiting jobs',
      },
    });
    if (isErr(transitioned)) return transitioned;

    if (transitioned.value) {
      orphanedCount += 1;
      logger?.warn(
        { videoId: video.id, thresholdMs },
        'marked orphaned PROCESSING video as FAILED and creating DLQ entry'
      );

      const parked = await repositories.dlq.create({
        id: uuidv7(),
        queue: 'housekeeping',
        jobId: `reconcile-processing--${video.id}`,
        videoId: video.id,
        errorCode: ErrorCodes.ORPHANED,
        errorMessage: 'Processing timed out with no active steps or waiting jobs',
        attemptsMade: 1,
        workerId,
        status: 'PARKED',
        payload: {
          videoId: video.id,
          status: video.status,
          sourceKey: video.sourceKey,
          generation: video.generation,
        },
      });
      if (isErr(parked)) return parked;
    }
  }

  return ok({ orphanedCount });
}

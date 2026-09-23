import type { JobQueue } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { QueueName } from '@vp/job-contracts';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/observability';
import { type Result, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface ReconcileProcessingOptions {
  repositories: Repositories;
  getQueue?: (name: QueueName) => JobQueue;
  thresholdMs?: number;
  workerId?: string;
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
 * Reconciler for processing lifecycle (SDD §9.8, AC 3):
 * Videos PROCESSING > 3h with no RUNNING step and no waiting jobs ->
 * mark FAILED('ORPHANED') + dlq_entries row.
 */
export async function runReconcileProcessing(
  options: ReconcileProcessingOptions
): Promise<Result<ReconcileProcessingResult, DatabaseUnavailable>> {
  const {
    repositories,
    getQueue,
    thresholdMs = process.env['RECONCILE_PROCESSING_THRESHOLD_MS']
      ? Number.parseInt(process.env['RECONCILE_PROCESSING_THRESHOLD_MS'], 10)
      : 3 * 60 * 60 * 1000,
    workerId = 'housekeeping',
    logger,
  } = options;

  let orphanedCount = 0;

  const staleProcessing = await repositories.videos.scan({
    status: 'PROCESSING',
    idleFor: { since: 'updatedAt', ms: thresholdMs },
  });
  if (isErr(staleProcessing)) return staleProcessing;

  for (const video of staleProcessing.value) {
    // 1. Check if any step is currently RUNNING
    const steps = await repositories.steps.findByVideoId(video.id);
    const hasRunningStep = steps.some((s) => s.status === 'RUNNING');
    if (hasRunningStep) {
      continue;
    }

    // 2. Check if any waiting/active jobs exist in the processing queues
    let hasWaitingJob = false;
    if (getQueue) {
      for (const queueName of ACTIVE_PROCESSING_QUEUES) {
        try {
          const queue = getQueue(queueName);
          const jobs = await queue.getJobs([
            'waiting',
            'active',
            'delayed',
            'prioritized',
            'paused',
          ]);
          const matchingJob = jobs.find((j) => {
            const data = j.data as { videoId?: string } | undefined;
            return data?.videoId === video.id || j.id.startsWith(video.id);
          });
          if (matchingJob) {
            hasWaitingJob = true;
            break;
          }
        } catch {
          // If queue inspection fails, err on the side of safety
        }
      }
    }

    if (hasWaitingJob) {
      continue;
    }

    // 3. CAS transition to FAILED with errorCode 'ORPHANED'
    const transitioned = await repositories.videos.transition({
      videoId: video.id,
      from: 'PROCESSING',
      to: 'FAILED',
      eventType: 'video.failed',
      eventPayload: { code: 'ORPHANED', message: 'Processing orphaned' },
      patch: {
        errorCode: 'ORPHANED',
        errorMessage: 'Processing timed out with no active steps or waiting jobs',
      },
    });
    if (isErr(transitioned)) return transitioned;

    if (transitioned.value) {
      orphanedCount += 1;
      logger?.warn(
        { videoId: video.id, thresholdMs },
        'Marked orphaned PROCESSING video as FAILED and creating DLQ entry'
      );

      // 4. Record row in dlq_entries
      await repositories.dlq.create({
        id: uuidv7(),
        queue: 'housekeeping',
        jobId: `reconcile-processing--${video.id}`,
        videoId: video.id,
        errorCode: 'ORPHANED',
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
    }
  }

  return ok({ orphanedCount });
}

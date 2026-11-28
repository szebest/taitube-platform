import { type DatabaseUnavailable } from '@kit/errors';
import type { Logger } from '@kit/logger';
import type { JobQueue } from '@kit/ports';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories, VideoRecord } from '@vp/core/repositories';
import { VIDEO_LIFECYCLE_EDGES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { QueueName } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';

export interface ReconcileProcessingOptions {
  repositories: Repositories;
  getQueue: (name: QueueName) => JobQueue;
  thresholdMs: number;
  scanLimit: number;
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
  'screen',
  'package',
];

/**
 * Whether any of `queues` holds a job for the video. A queue that cannot be inspected is assumed to
 * hold one, which leaves a live video alone rather than failing it.
 */
export async function hasPendingJob(
  getQueue: (name: QueueName) => JobQueue,
  queues: readonly QueueName[],
  videoId: string
): Promise<boolean> {
  for (const queueName of queues) {
    const jobs = await getQueue(queueName).getJobs(['waiting', 'active', 'delayed', 'prioritized']);
    if (isErr(jobs)) return true;

    const pending = jobs.value.some((job) => {
      const data = job.data as { videoId?: string } | undefined;
      return data?.videoId === videoId || job.id.startsWith(videoId);
    });
    if (pending) return true;
  }
  return false;
}

interface Orphan {
  task: string;
  video: VideoRecord;
  message: string;
  workerId: string;
}

/** Parks a video a reconciler failed as `ORPHANED` in the DLQ, so it shows up beside failed jobs. */
export async function parkOrphan(
  repositories: Pick<Repositories, 'dlq'>,
  { task, video, message, workerId }: Orphan
): Promise<Result<void, DatabaseUnavailable>> {
  const parked = await repositories.dlq.create({
    id: uuidv7(),
    queue: 'housekeeping',
    jobId: `${task}--${video.id}`,
    videoId: video.id,
    errorCode: ErrorCodes.ORPHANED,
    errorMessage: message,
    attemptsMade: 1,
    workerId,
    payload: {
      videoId: video.id,
      status: video.status,
      sourceKey: video.sourceKey,
      generation: video.generation,
    },
  });
  return isErr(parked) ? parked : ok();
}

const ORPHANED_MESSAGE = 'Processing timed out with no active steps or waiting jobs';

/**
 * Fails a video left PROBING or PROCESSING past the threshold with no RUNNING step and no job
 * waiting in any processing queue, as `ORPHANED`, and parks a DLQ entry for it (SDD §9.8).
 */
export async function runReconcileProcessing(
  options: ReconcileProcessingOptions
): Promise<Result<ReconcileProcessingResult, DatabaseUnavailable>> {
  const { repositories, getQueue, thresholdMs, scanLimit, workerId, logger } = options;

  const stale: VideoRecord[] = [];
  for (const status of VIDEO_LIFECYCLE_EDGES.reconcileFail.from) {
    const scanned = await repositories.videos.scan({
      status,
      idleFor: { since: 'updatedAt', ms: thresholdMs },
      limit: scanLimit,
    });
    if (isErr(scanned)) return scanned;
    stale.push(...scanned.value);
  }

  let orphanedCount = 0;
  for (const video of stale) {
    const steps = await repositories.steps.findByVideoId(video.id);
    if (isErr(steps)) return steps;
    if (steps.value.some((s) => s.status === 'RUNNING')) continue;
    if (await hasPendingJob(getQueue, ACTIVE_PROCESSING_QUEUES, video.id)) continue;

    const transitioned = await repositories.videos.transition({
      videoId: video.id,
      edge: 'reconcileFail',
      eventPayload: { code: ErrorCodes.ORPHANED, message: 'Processing orphaned' },
      patch: { errorCode: ErrorCodes.ORPHANED, errorMessage: ORPHANED_MESSAGE },
    });
    if (isErr(transitioned)) return transitioned;
    if (!transitioned.value) continue;

    orphanedCount += 1;
    logger?.warn({ videoId: video.id, thresholdMs }, 'failed an orphaned video and parked it');
    const parked = await parkOrphan(repositories, {
      task: 'reconcile-processing',
      video,
      message: ORPHANED_MESSAGE,
      workerId,
    });
    if (isErr(parked)) return parked;
  }

  return ok({ orphanedCount });
}

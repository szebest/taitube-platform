import type { Logger } from '@kit/logger';
import { type Result, isErr, ok } from '@kit/result';
import type { JobQueue } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { LIVE_STREAM } from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { QueueName } from '@vp/job-contracts';
import { hasPendingJob, parkOrphan } from './reconcile-processing';

export interface ReconcileLiveOptions {
  repositories: Repositories;
  getQueue: (name: QueueName) => JobQueue;
  thresholdMs: number;
  scanLimit: number;
  workerId: string;
  logger?: Logger;
}

export interface ReconcileLiveResult {
  orphanedCount: number;
}

const ORPHANED_MESSAGE = 'The broadcast ended and nothing finalized its video';

/**
 * Fails a video left LIVE past the threshold whose stream is off air and has no live job left to
 * finalize it, as `ORPHANED`, and parks a DLQ entry for it, as the processing reconciler does.
 */
export async function runReconcileLive(
  options: ReconcileLiveOptions
): Promise<Result<ReconcileLiveResult, DatabaseUnavailable>> {
  const { repositories, getQueue, thresholdMs, scanLimit, workerId, logger } = options;

  const stale = await repositories.videos.scan({
    status: 'LIVE',
    idleFor: { since: 'updatedAt', ms: thresholdMs },
    limit: scanLimit,
  });
  if (isErr(stale)) return stale;

  let orphanedCount = 0;
  for (const video of stale.value) {
    const stream = await repositories.liveStreams.findByVideoId(video.id);
    if (isErr(stream)) return stream;
    if (stream.value && LIVE_STREAM.next(stream.value.status, 'end')) continue;
    if (await hasPendingJob(getQueue, ['live'], video.id)) continue;

    const transitioned = await repositories.videos.transition({
      videoId: video.id,
      edge: 'failLive',
      eventPayload: { code: ErrorCodes.ORPHANED, liveStreamId: stream.value?.id ?? null },
      patch: { errorCode: ErrorCodes.ORPHANED, errorMessage: ORPHANED_MESSAGE },
    });
    if (isErr(transitioned)) return transitioned;
    if (!transitioned.value) continue;

    orphanedCount += 1;
    logger?.warn({ videoId: video.id, thresholdMs }, 'failed an orphaned live video and parked it');
    const parked = await parkOrphan(repositories, {
      task: 'reconcile-live',
      video,
      message: ORPHANED_MESSAGE,
      workerId,
    });
    if (isErr(parked)) return parked;
  }

  return ok({ orphanedCount });
}

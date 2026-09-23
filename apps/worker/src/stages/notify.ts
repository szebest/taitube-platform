import type { CacheClient, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import { publishVideoEvent, userChannel, videoChannel } from '@vp/events';
import type { NotifyJob } from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import { type Result, isErr, map, ok, unwrapOr } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry';

export interface NotifyProcessorDeps {
  repositories: Repositories;
  cache: CacheClient;
  workerId?: string;
  logger: Logger;
}

export interface NotifyResult {
  videoId: string;
  published: boolean;
}

export type NotifyFailure = DatabaseUnavailable | CacheUnavailable;

export function createNotifyProcessor(deps: NotifyProcessorDeps) {
  const { repositories, cache, workerId = `worker-${process.pid}`, logger } = deps;

  return async function processNotifyJob(
    job: QueueJob<NotifyJob>
  ): Promise<Result<NotifyResult, NotifyFailure>> {
    validateJobId(job.id || '');

    const { videoId, userId, payload } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = logger.child({ videoId, jobId: job.id, stage: 'notify', attempt });

    log.info({ userId }, 'Notify job started');

    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'notify',
      rendition: '-',
      jobId: job.id || '',
      attempt,
      workerId,
      lockToken,
    });
    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'Notify step already completed; fenced out');
      return ok({ videoId, published: false });
    }

    const beat = await repositories.steps.heartbeat(lockToken);
    if (isErr(beat)) return beat;

    // A dead event store costs the client its resume id, not its status update.
    const latestId = unwrapOr(await repositories.events.getLatestEventId(videoId), 0);
    const now = Date.now();

    await publishVideoEvent({
      cache,
      videoId,
      userId,
      event: 'status',
      data: {
        status: (payload['status'] as string) || 'READY',
        playbackUrl: payload['playbackUrl'] as string | undefined,
      },
      id: latestId > 0 ? latestId : undefined,
      ts: now,
    });

    const channels = [videoChannel(videoId), userChannel(userId)];
    log.info({ channels, latestId }, 'Published status update to Redis channels');

    getMetrics().sseEventsPublished.inc({ event: 'status' });

    return map(
      await repositories.steps.complete({
        videoId,
        step: 'notify',
        rendition: '-',
        lockToken,
        result: { channels },
      }),
      () => ({ videoId, published: true })
    );
  };
}

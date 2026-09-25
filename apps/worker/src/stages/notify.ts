import type { CacheClient, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import { publishVideoEvent, userChannel, videoChannel } from '@vp/events';
import type { NotifyJob } from '@vp/job-contracts';
import type { PipelineMetrics } from '@vp/observability';
import type { Logger } from '@vp/logger';
import { type Result, isErr, map, ok, unwrapOr } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface NotifyProcessorDeps {
  repositories: Repositories;
  cache: CacheClient;
  metrics: PipelineMetrics;
  workerId: string;
  logger: Logger;
}

export interface NotifyResult {
  videoId: string;
  published: boolean;
}

export type NotifyFailure = DatabaseUnavailable | CacheUnavailable;

export function createNotifyProcessor(deps: NotifyProcessorDeps) {
  const { repositories, cache, metrics, workerId, logger } = deps;

  return async function processNotifyJob(
    job: QueueJob<NotifyJob>
  ): Promise<Result<NotifyResult, NotifyFailure>> {
    const { videoId, userId, payload } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = logger.child({ videoId, jobId: job.id, stage: 'notify', attempt });

    log.info({ userId }, 'notify job started');

    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'notify',
      rendition: '-',
      jobId: job.id,
      attempt,
      workerId,
      lockToken,
    });
    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'notify step already completed; fenced out');
      return ok({ videoId, published: false });
    }

    const beat = await repositories.steps.heartbeat(lockToken);
    if (isErr(beat)) return beat;

    // A dead event store costs the client its resume id, not its status update.
    const latestId = unwrapOr(await repositories.events.getLatestEventId(videoId), 0);
    const now = Date.now();

    const published = await publishVideoEvent({
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
    if (isErr(published)) return published;

    const channels = [videoChannel(videoId), userChannel(userId)];
    log.info({ channels, latestId }, 'published status update to Redis channels');

    metrics.sseEventsPublished.inc({ event: 'status' });

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

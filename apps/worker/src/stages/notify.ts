import type { CacheClient, QueueJob, Repositories } from '@vp/core/ports';
import { publishVideoEvent, userChannel, videoChannel } from '@vp/events';
import type { NotifyJob } from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry';

export interface NotifyProcessorDeps {
  repositories: Repositories;
  cache: CacheClient;
  workerId?: string;
  logger: Logger;
}

export function createNotifyProcessor(deps: NotifyProcessorDeps) {
  const { repositories, cache, workerId = `worker-${process.pid}`, logger } = deps;

  return async function processNotifyJob(
    job: QueueJob<NotifyJob>
  ): Promise<{ videoId: string; published: boolean }> {
    validateJobId(job.id || '');

    const { videoId, userId, payload } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: 'notify',
      attempt: (job.attemptsMade ?? 0) + 1,
    });

    log.info({ userId }, 'Notify job started');

    // 1. Claim step
    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'notify',
      rendition: '-',
      jobId: job.id || '',
      attempt: (job.attemptsMade ?? 0) + 1,
      workerId,
      lockToken,
    });

    if (claim.fenced) {
      log.warn({ lockToken }, 'Notify step already completed; fenced out');
      return { videoId, published: false };
    }

    await repositories.steps.heartbeat(lockToken);

    try {
      // 2. AC 20: Publish {event:'status', data:{status:'READY', playbackUrl}} on video:{id} and user:{uid} with ts
      const now = Date.now();
      const latestId = await repositories.events.getLatestEventId(videoId).catch(() => 0);
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

      const chVideo = videoChannel(videoId);
      const chUser = userChannel(userId);
      log.info({ chVideo, chUser, latestId }, 'Published status update to Redis channels');

      // Record sse_events_published_total (Ticket 22 / SDD §13.1)
      getMetrics().sseEventsPublished.inc({ event: 'status' });

      // 3. Complete step
      await repositories.steps.complete({
        videoId,
        step: 'notify',
        rendition: '-',
        lockToken,
        result: {
          channels: [chVideo, chUser],
        },
      });

      return { videoId, published: true };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Notify failed';
      await repositories.steps.fail({
        videoId,
        step: 'notify',
        rendition: '-',
        lockToken,
        errorCode: 'NOTIFY_FAILED',
        errorMessage: errorMsg,
      });
      throw err;
    }
  };
}

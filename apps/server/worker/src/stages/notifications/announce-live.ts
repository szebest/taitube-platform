import type { JobQueue, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { liveStarted, NOTIFICATION_FANOUT_BATCH, toChannelCard } from '@vp/domain';
import type { DatabaseUnavailable, QueueUnavailable } from '@vp/errors';
import { type AnnounceLiveJob, announceLiveOutbox } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { isErr, ok, type Result } from '@vp/result';

export interface AnnounceLiveDeps {
  repositories: Repositories;
  getQueue: (name: string) => JobQueue;
  logger: Logger;
  batchSize?: number;
}

export interface AnnounceLiveResult {
  liveStreamId: string;
  announced: number;
  hasMore: boolean;
}

/**
 * One batch of a channel's subscribers, each told `live.started` on their user stream. It refreshes
 * what an open tab shows, so it ignores notification levels and switches; the bell is
 * `notify-subscribers`. A stream no longer live, or not public, tells nobody.
 */
export function createAnnounceLiveProcessor(deps: AnnounceLiveDeps) {
  const { repositories, getQueue, logger, batchSize = NOTIFICATION_FANOUT_BATCH } = deps;

  return async function processAnnounceLive(
    job: QueueJob<AnnounceLiveJob>
  ): Promise<Result<AnnounceLiveResult, DatabaseUnavailable | QueueUnavailable>> {
    const { liveStreamId, after } = job.data;
    const skipped = ok({ liveStreamId, announced: 0, hasMore: false });

    const stream = await repositories.liveStreams.findById(liveStreamId);
    if (isErr(stream)) return stream;
    const live = stream.value;
    if (!(live?.status === 'LIVE' && live.visibility === 'public')) return skipped;
    const { videoId, startedAt } = live;
    if (videoId === null || startedAt === null) return skipped;

    const channel = await repositories.channels.findById(live.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return skipped;

    const batch = await repositories.subscriptions.listSubscribers(channel.value.id, {
      after,
      limit: batchSize,
    });
    if (isErr(batch)) return batch;

    const event = liveStarted({
      liveStreamId,
      videoId,
      title: live.title || channel.value.displayName,
      startedAt: startedAt.toISOString(),
      channel: toChannelCard(channel.value),
    });
    for (const { subscriberId } of batch.value) {
      const appended = await repositories.userEvents.append({ userId: subscriberId, ...event });
      if (isErr(appended)) return appended;
    }

    const last = batch.value.at(-1);
    const hasMore = batch.value.length === batchSize && last !== undefined;
    if (hasMore) {
      const { name, data, opts } = announceLiveOutbox({
        ...job.data,
        after: last.subscriberId,
      }).payload.job;
      const next = await getQueue('notify').add(name, data, opts);
      if (isErr(next)) return next;
    }

    logger.info({ liveStreamId, announced: batch.value.length, hasMore }, 'announced a broadcast');
    return ok({ liveStreamId, announced: batch.value.length, hasMore });
  };
}

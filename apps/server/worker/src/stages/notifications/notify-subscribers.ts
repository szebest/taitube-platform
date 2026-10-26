import type { JobQueue, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { NOTIFICATION_FANOUT_BATCH, levelAllows, type NotificationActor } from '@vp/domain';
import type { DatabaseUnavailable, QueueUnavailable } from '@vp/errors';
import { type NotifySubscribersJob, subscribersOutbox } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';
import { usersSwitchedOn } from './notification-switches';

export interface NotifySubscribersDeps {
  repositories: Repositories;
  getQueue: (name: string) => JobQueue;
  logger: Logger;
  batchSize?: number;
}

export interface NotifySubscribersResult {
  videoId: string;
  recorded: number;
  hasMore: boolean;
}

/**
 * One batch of a channel's subscribers, each given a notification when their level and their
 * account switch allow it; a full batch enqueues the next one after its last subscriber. A repeated
 * batch records nothing twice, because a notification of the same video is never counted again.
 */
export function createNotifySubscribersProcessor(deps: NotifySubscribersDeps) {
  const { repositories, getQueue, logger, batchSize = NOTIFICATION_FANOUT_BATCH } = deps;

  return async function processNotifySubscribers(
    job: QueueJob<NotifySubscribersJob>
  ): Promise<Result<NotifySubscribersResult, DatabaseUnavailable | QueueUnavailable>> {
    const { kind, videoId, after } = job.data;
    const skipped = ok({ videoId, recorded: 0, hasMore: false });

    const video = await repositories.videos.findById(videoId);
    if (isErr(video)) return video;
    const stillPublic =
      video.value &&
      !video.value.deletedAt &&
      video.value.status === 'READY' &&
      video.value.visibility === 'public';
    if (!(video.value && (kind === 'live' || stillPublic))) return skipped;

    const channel = await repositories.channels.findByUserId(video.value.ownerId);
    if (isErr(channel)) return channel;
    if (!channel.value) return skipped;

    const batch = await repositories.subscriptions.listSubscribers(channel.value.id, {
      after,
      limit: batchSize,
    });
    if (isErr(batch)) return batch;

    const levelled = batch.value.filter((subscriber) =>
      levelAllows(subscriber.notificationLevel, kind)
    );
    const switchedOn = await usersSwitchedOn(
      repositories,
      levelled.map((subscriber) => subscriber.subscriberId),
      kind
    );
    if (isErr(switchedOn)) return switchedOn;

    const actor: NotificationActor = {
      handle: channel.value.handle,
      displayName: channel.value.displayName,
      avatarUrl: channel.value.avatarUrl,
    };
    let recorded = 0;
    for (const { subscriberId } of levelled) {
      if (!switchedOn.value.has(subscriberId)) continue;

      const saved = await repositories.notifications.record({
        userId: subscriberId,
        kind,
        actorChannelId: channel.value.id,
        videoId,
        commentId: null,
        groupKey: `${kind}:${channel.value.id}`,
        payload: { actor, videoTitle: video.value.title, excerpt: null, outcome: null },
      });
      if (isErr(saved)) return saved;
      recorded += saved.value ? 1 : 0;
    }

    const last = batch.value.at(-1);
    const hasMore = batch.value.length === batchSize && last !== undefined;
    if (hasMore) {
      const { name, data, opts } = subscribersOutbox({
        ...job.data,
        after: last.subscriberId,
      }).payload.job;
      const next = await getQueue('notify').add(name, data, opts);
      if (isErr(next)) return next;
    }

    logger.info({ videoId, kind, recorded, hasMore }, 'notified a batch of subscribers');
    return ok({ videoId, recorded, hasMore });
  };
}

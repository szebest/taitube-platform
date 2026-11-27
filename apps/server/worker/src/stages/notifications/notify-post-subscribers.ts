import type { Logger } from '@kit/logger';
import { isErr, ok, type Result } from '@kit/result';
import type { JobQueue, QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { levelAllows, NOTIFICATION_FANOUT_BATCH, type NotificationActor } from '@vp/domain';
import type { DatabaseUnavailable, QueueUnavailable } from '@vp/errors';
import { type NotifyPostSubscribersJob, postSubscribersOutbox } from '@vp/job-contracts';
import { usersSwitchedOn } from './notification-switches';
import { postExcerpt } from './post-excerpt';

export interface NotifyPostSubscribersDeps {
  repositories: Repositories;
  getQueue: (name: string) => JobQueue;
  logger: Logger;
  batchSize?: number;
}

export interface NotifyPostSubscribersResult {
  postId: string;
  recorded: number;
  hasMore: boolean;
}

/**
 * One batch of a channel's subscribers, each given a `post` notification when their level and
 * their account switch allow it; a full batch enqueues the next one after its last subscriber.
 * A repeated batch records nothing twice, because a notification of the same post is never
 * counted again.
 */
export function createNotifyPostSubscribersProcessor(deps: NotifyPostSubscribersDeps) {
  const { repositories, getQueue, logger, batchSize = NOTIFICATION_FANOUT_BATCH } = deps;

  return async function processNotifyPostSubscribers(
    job: QueueJob<NotifyPostSubscribersJob>
  ): Promise<Result<NotifyPostSubscribersResult, DatabaseUnavailable | QueueUnavailable>> {
    const { postId, after } = job.data;
    const skipped = ok({ postId, recorded: 0, hasMore: false });

    const post = await repositories.channelPosts.findById(postId);
    if (isErr(post)) return post;
    if (post.value?.status !== 'published') return skipped;

    const channel = await repositories.channels.findById(post.value.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return skipped;

    const batch = await repositories.subscriptions.listSubscribers(channel.value.id, {
      after,
      limit: batchSize,
    });
    if (isErr(batch)) return batch;

    const levelled = batch.value.filter((subscriber) =>
      levelAllows(subscriber.notificationLevel, 'post')
    );
    const switchedOn = await usersSwitchedOn(
      repositories,
      levelled.map((subscriber) => subscriber.subscriberId),
      'post'
    );
    if (isErr(switchedOn)) return switchedOn;

    const actor: NotificationActor = {
      handle: channel.value.handle,
      displayName: channel.value.displayName,
      avatarUrl: channel.value.avatarUrl,
    };
    const excerpt = postExcerpt(post.value.payload);
    let recorded = 0;
    for (const { subscriberId } of levelled) {
      if (!switchedOn.value.has(subscriberId)) continue;

      const saved = await repositories.notifications.record({
        userId: subscriberId,
        kind: 'post',
        actorChannelId: channel.value.id,
        videoId: null,
        commentId: null,
        groupKey: `post:${channel.value.id}`,
        payload: { actor, videoTitle: null, excerpt, outcome: null, postId },
      });
      if (isErr(saved)) return saved;
      recorded += saved.value ? 1 : 0;
    }

    const last = batch.value.at(-1);
    const hasMore = batch.value.length === batchSize && last !== undefined;
    if (hasMore) {
      const { name, data, opts } = postSubscribersOutbox({
        ...job.data,
        after: last.subscriberId,
      }).payload.job;
      const next = await getQueue('notify').add(name, data, opts);
      if (isErr(next)) return next;
    }

    logger.info({ postId, recorded, hasMore }, 'notified a batch of post subscribers');
    return ok({ postId, recorded, hasMore });
  };
}

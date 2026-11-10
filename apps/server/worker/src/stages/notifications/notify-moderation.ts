import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyModerationJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { isErr, ok, type Result } from '@vp/result';

export interface NotifyModerationDeps {
  repositories: Repositories;
  logger: Logger;
}

export interface NotifyModerationResult {
  eventId: string;
  recorded: boolean;
}

const STATE_OF = { hold: 'held', hide: 'hidden' } as const;

/**
 * Tells a user that a moderator acted visibly on them: a hold or hide while it still stands, a
 * removal, a ban until it ends. A silent action never reaches this queue.
 */
export function createNotifyModerationProcessor(deps: NotifyModerationDeps) {
  const { repositories, logger } = deps;

  return async function processNotifyModeration(
    job: QueueJob<NotifyModerationJob>
  ): Promise<Result<NotifyModerationResult, DatabaseUnavailable>> {
    const { eventId, userId, action, channelId, videoId, commentId, reason, expiresAt } = job.data;
    const skipped = ok({ eventId, recorded: false });

    const current = await standsStill(repositories, job.data);
    if (isErr(current)) return current;
    if (!current.value) return skipped;

    const channel = await repositories.channels.findById(channelId);
    if (isErr(channel)) return channel;
    const actor = channel.value && {
      handle: channel.value.handle,
      displayName: channel.value.displayName,
      avatarUrl: channel.value.avatarUrl,
    };

    const saved = await repositories.notifications.record({
      userId,
      kind: 'moderation',
      actorChannelId: channelId,
      videoId,
      commentId,
      groupKey: `moderation:${eventId}`,
      payload: {
        actor: actor ?? null,
        videoTitle: null,
        excerpt: job.data.excerpt,
        outcome: null,
        moderation: { action, reason, expiresAt },
      },
    });
    if (isErr(saved)) return saved;

    logger.info({ eventId, action }, 'told a user about a visible moderation action');
    return ok({ eventId, recorded: saved.value !== null });
  };
}

async function standsStill(
  repositories: Repositories,
  { action, commentId, channelId, userId }: NotifyModerationJob
): Promise<Result<boolean, DatabaseUnavailable>> {
  if (action === 'remove') return ok(true);

  if (action === 'ban') {
    const ban = await repositories.channelUserRestrictions.findActive(
      channelId,
      userId,
      new Date()
    );
    return isErr(ban) ? ban : ok(ban.value?.kind === 'ban');
  }

  if (!commentId) return ok(false);
  const comment = await repositories.comments.findById(commentId);
  return isErr(comment) ? comment : ok(comment.value?.moderationState === STATE_OF[action]);
}

import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { mayHearAbout, NOTIFICATION_EXCERPT_LENGTH, type NotificationActor } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyHeartJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { isErr, ok, type Result } from '@vp/result';
import { usersSwitchedOn } from './notification-switches';

export interface NotifyHeartDeps {
  repositories: Repositories;
  logger: Logger;
}

export interface NotifyHeartResult {
  commentId: string;
  recorded: boolean;
}

/** Tells a comment's author that the video's creator hearted it, while the heart still stands. */
export function createNotifyHeartProcessor(deps: NotifyHeartDeps) {
  const { repositories, logger } = deps;

  return async function processNotifyHeart(
    job: QueueJob<NotifyHeartJob>
  ): Promise<Result<NotifyHeartResult, DatabaseUnavailable>> {
    const { commentId, videoId } = job.data;
    const skipped = ok({ commentId, recorded: false });

    const comment = await repositories.comments.findById(commentId);
    if (isErr(comment)) return comment;
    const video = await repositories.videos.findById(videoId);
    if (isErr(video)) return video;
    if (!(comment.value && video.value && comment.value.heartedAt)) return skipped;

    const { authorId } = comment.value;
    if (authorId === video.value.ownerId || !mayHearAbout(video.value, authorId)) return skipped;

    const switchedOn = await usersSwitchedOn(repositories, [authorId], 'heart');
    if (isErr(switchedOn)) return switchedOn;
    if (!switchedOn.value.has(authorId)) return skipped;

    const creator = await repositories.channels.findByUserId(video.value.ownerId);
    if (isErr(creator)) return creator;
    const actor: NotificationActor | null = creator.value && {
      handle: creator.value.handle,
      displayName: creator.value.displayName,
      avatarUrl: creator.value.avatarUrl,
    };

    const saved = await repositories.notifications.record({
      userId: authorId,
      kind: 'heart',
      actorChannelId: creator.value?.id ?? null,
      videoId,
      commentId,
      groupKey: `heart:${videoId}`,
      payload: {
        actor,
        videoTitle: video.value.title,
        excerpt: comment.value.content.slice(0, NOTIFICATION_EXCERPT_LENGTH),
        outcome: null,
      },
    });
    if (isErr(saved)) return saved;

    logger.info({ commentId }, 'told an author the creator hearted their comment');
    return ok({ commentId, recorded: saved.value !== null });
  };
}

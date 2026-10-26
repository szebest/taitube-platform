import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { type Comment, type NotificationActor, mentionedHandles } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyCommentJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';
import { usersSwitchedOn } from './notification-switches';

const EXCERPT_LENGTH = 140;

export interface NotifyCommentDeps {
  repositories: Repositories;
  logger: Logger;
}

export interface NotifyCommentResult {
  commentId: string;
  recorded: number;
}

const GROUP_KEYS = {
  comment: (comment: Comment) => `comment:${comment.videoId}`,
  reply: (comment: Comment) => `reply:${comment.parentId}`,
  mention: (comment: Comment) => `mention:${comment.id}`,
} as const;

type CommentKind = keyof typeof GROUP_KEYS;

/** Who a comment is for, one kind each: a mention outranks a reply, which outranks a comment on the video. */
function recipientsOf(
  comment: Comment,
  parentAuthorId: string | null,
  mentionedUserIds: readonly string[],
  videoOwnerId: string
): Map<string, CommentKind> {
  const recipients = new Map<string, CommentKind>();
  if (comment.parentId === null) recipients.set(videoOwnerId, 'comment');
  if (parentAuthorId) recipients.set(parentAuthorId, 'reply');
  for (const userId of mentionedUserIds) recipients.set(userId, 'mention');

  recipients.delete(comment.authorId);
  return recipients;
}

export function createNotifyCommentProcessor(deps: NotifyCommentDeps) {
  const { repositories, logger } = deps;

  return async function processNotifyComment(
    job: QueueJob<NotifyCommentJob>
  ): Promise<Result<NotifyCommentResult, DatabaseUnavailable>> {
    const { commentId, videoId } = job.data;
    const skipped = ok({ commentId, recorded: 0 });

    const comment = await repositories.comments.findById(commentId);
    if (isErr(comment)) return comment;
    const video = await repositories.videos.findById(videoId);
    if (isErr(video)) return video;
    if (!(comment.value && video.value) || video.value.deletedAt) return skipped;

    const parent = comment.value.parentId
      ? await repositories.comments.findById(comment.value.parentId)
      : ok(null);
    if (isErr(parent)) return parent;

    const mentioned: string[] = [];
    for (const handle of mentionedHandles(comment.value.content)) {
      const channel = await repositories.channels.findByHandle(handle);
      if (isErr(channel)) return channel;
      if (channel.value) mentioned.push(channel.value.userId);
    }

    const recipients = recipientsOf(
      comment.value,
      parent.value?.authorId ?? null,
      mentioned,
      video.value.ownerId
    );
    const allowed = new Map<string, CommentKind>();
    for (const kind of new Set(recipients.values())) {
      const userIds = [...recipients].filter(([, wanted]) => wanted === kind).map(([id]) => id);
      const switchedOn = await usersSwitchedOn(repositories, userIds, kind);
      if (isErr(switchedOn)) return switchedOn;
      for (const userId of switchedOn.value) allowed.set(userId, kind);
    }

    const author = await repositories.channels.findByUserId(comment.value.authorId);
    if (isErr(author)) return author;
    const actor: NotificationActor | null = author.value && {
      handle: author.value.handle,
      displayName: author.value.displayName,
      avatarUrl: author.value.avatarUrl,
    };

    let recorded = 0;
    for (const [userId, kind] of allowed) {
      const saved = await repositories.notifications.record({
        userId,
        kind,
        actorChannelId: author.value?.id ?? null,
        videoId,
        commentId,
        groupKey: GROUP_KEYS[kind](comment.value),
        payload: {
          actor,
          videoTitle: video.value.title,
          excerpt: comment.value.content.slice(0, EXCERPT_LENGTH),
          outcome: null,
        },
      });
      if (isErr(saved)) return saved;
      recorded += saved.value ? 1 : 0;
    }

    logger.info({ commentId, recorded }, 'notified the people a comment is for');
    return ok({ commentId, recorded });
  };
}

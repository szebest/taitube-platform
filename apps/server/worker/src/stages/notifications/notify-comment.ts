import type { DatabaseUnavailable } from '@kit/errors';
import type { Logger } from '@kit/logger';
import type { QueueJob } from '@kit/ports';
import { isErr, ok, type Result } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import {
  type Comment,
  mentionedHandles,
  NOTIFICATION_EXCERPT_LENGTH,
  type NotificationActor,
} from '@vp/domain';
import type { NotifyCommentJob } from '@vp/job-contracts';
import { usersSwitchedOn } from './notification-switches';
import { type CommentSubject, commentSubjectOf } from './notify-comment-subject';

export interface NotifyCommentDeps {
  repositories: Repositories;
  logger: Logger;
}

export interface NotifyCommentResult {
  commentId: string;
  recorded: number;
}

const GROUP_KEYS = {
  comment: (comment: Comment) => `comment:${comment.target.id}`,
  reply: (comment: Comment) => `reply:${comment.parentId}`,
  mention: (comment: Comment) => `mention:${comment.id}`,
} as const;

type CommentKind = keyof typeof GROUP_KEYS;

/** Who a comment is for, one kind each: a mention outranks a reply, which outranks a comment on a video. */
function recipientsOf(
  comment: Comment,
  parentAuthorId: string | null,
  mentionedUserIds: readonly string[],
  subject: CommentSubject
): Map<string, CommentKind> {
  const recipients = new Map<string, CommentKind>();
  if (comment.parentId === null && comment.target.type === 'video') {
    recipients.set(subject.ownerId, 'comment');
  }
  if (parentAuthorId) recipients.set(parentAuthorId, 'reply');
  for (const userId of mentionedUserIds) recipients.set(userId, 'mention');

  recipients.delete(comment.authorId);
  return recipients;
}

/**
 * Re-reads the comment as an anonymous reader would: one that was held, hidden or shadow banned
 * since it was queued has nobody to tell, and a held one never meets this job again until it is
 * approved.
 */
export function createNotifyCommentProcessor(deps: NotifyCommentDeps) {
  const { repositories, logger } = deps;

  return async function processNotifyComment(
    job: QueueJob<NotifyCommentJob>
  ): Promise<Result<NotifyCommentResult, DatabaseUnavailable>> {
    const { commentId, target } = job.data;
    const skipped = ok({ commentId, recorded: 0 });

    const comment = await repositories.comments.findVisible(null, commentId);
    if (isErr(comment)) return comment;
    const subject = await commentSubjectOf(repositories, target);
    if (isErr(subject)) return subject;
    if (!(comment.value && subject.value)) return skipped;
    const { videoId, videoTitle, link } = subject.value;

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
      subject.value
    );
    for (const userId of recipients.keys()) {
      if (!subject.value.mayHear(userId)) recipients.delete(userId);
    }
    const allowed = new Map<string, CommentKind>();
    for (const kind of new Set(recipients.values())) {
      const userIds = [...recipients].filter(([, wanted]) => wanted === kind).map(([id]) => id);
      const switchedOn = await usersSwitchedOn(repositories, userIds, kind);
      if (isErr(switchedOn)) return switchedOn;
      for (const userId of switchedOn.value) allowed.set(userId, kind);
    }

    const author = await repositories.channels.findById(comment.value.authorChannelId);
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
          videoTitle,
          excerpt: comment.value.content.slice(0, NOTIFICATION_EXCERPT_LENGTH),
          outcome: null,
          ...link,
        },
      });
      if (isErr(saved)) return saved;
      recorded += saved.value ? 1 : 0;
    }

    logger.info({ commentId, recorded }, 'notified the people a comment is for');
    return ok({ commentId, recorded });
  };
}

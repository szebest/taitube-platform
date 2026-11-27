import type { DatabaseUnavailable } from '@kit/errors';
import { isErr, ok, type Result } from '@kit/result';
import type { OutboxRepository, UserEventRepository } from '@vp/core/repositories';
import { type CommentThread, commentCreated, commentHeld, type NewCommentInput } from '@vp/domain';
import { commentHeldOutbox, commentOutbox } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';
import type { TargetOwner } from './comment-targets';

export interface AnnounceDeps {
  userEventsRepo: Pick<UserEventRepository, 'append'>;
  outboxRepo: Pick<OutboxRepository, 'enqueue'>;
}

interface Announcement {
  created: CommentThread;
  owner: TargetOwner | null;
  input: Pick<NewCommentInput, 'authorId' | 'moderation' | 'moderators'>;
  /** Whether the comment landed in the public count. */
  counted: boolean;
}

/**
 * What the transaction of a new comment tells people: a public one reaches the notification job, and
 * on a video the owner too; a held one reaches the moderators the service named.
 */
export async function announceCreated(
  deps: AnnounceDeps,
  { created, owner, input, counted }: Announcement
): Promise<Result<void, DatabaseUnavailable>> {
  if (counted && owner) {
    const enqueued = await deps.outboxRepo.enqueue(
      commentOutbox({ target: created.target, commentId: created.id })
    );
    if (isErr(enqueued)) return enqueued;

    if (owner.type === 'video' && owner.ownerId !== input.authorId) {
      const announced = await deps.userEventsRepo.append({
        userId: owner.ownerId,
        ...commentCreated(created, { id: owner.id, title: owner.title }),
      });
      if (isErr(announced)) return announced;
    }
  }

  if (input.moderation?.moderationState === 'held') {
    return await announceHeld(deps, created, input.moderators ?? []);
  }
  return ok();
}

/**
 * A held comment reaches the moderators the service named, never its own author: on their stream,
 * and through one job that tells their `comment.held` webhooks.
 */
export async function announceHeld(
  { userEventsRepo, outboxRepo }: AnnounceDeps,
  held: CommentThread,
  moderators: readonly string[]
): Promise<Result<void, DatabaseUnavailable>> {
  const recipients = moderators.filter((userId) => userId !== held.authorId);
  if (recipients.length === 0) return ok();
  for (const userId of recipients) {
    const told = await userEventsRepo.append({ userId, ...commentHeld(held) });
    if (isErr(told)) return told;
  }
  if (held.target.type !== 'video') return ok();
  const job = { holdId: uuidv7(), commentId: held.id, videoId: held.target.id, recipients };
  const enqueued = await outboxRepo.enqueue(commentHeldOutbox(job));
  return isErr(enqueued) ? enqueued : ok();
}

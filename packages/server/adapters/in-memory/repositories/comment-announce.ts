import { isErr, ok, type Result } from '@kit/result';
import type { OutboxRepository, UserEventRepository } from '@vp/core/repositories';
import { type CommentThread, commentCreated, commentHeld, type NewCommentInput } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { commentHeldOutbox, commentOutbox } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';

export interface AnnounceDeps {
  userEventsRepo: Pick<UserEventRepository, 'append'>;
  outboxRepo: Pick<OutboxRepository, 'enqueue'>;
}

interface Announcement {
  created: CommentThread;
  video: { id: string; ownerId: string; title?: string | null } | null;
  input: Pick<NewCommentInput, 'authorId' | 'moderation' | 'moderators'>;
  /** Whether the comment landed in the public count. */
  counted: boolean;
}

/**
 * What the transaction of a new comment tells people: a public one reaches the notification job
 * and the video owner, a held one reaches the moderators the service named.
 */
export async function announceCreated(
  deps: AnnounceDeps,
  { created, video, input, counted }: Announcement
): Promise<Result<void, DatabaseUnavailable>> {
  if (counted) {
    const enqueued = await deps.outboxRepo.enqueue(
      commentOutbox({ videoId: created.videoId, commentId: created.id })
    );
    if (isErr(enqueued)) return enqueued;
  }

  if (counted && video && video.ownerId !== input.authorId) {
    const announced = await deps.userEventsRepo.append({
      userId: video.ownerId,
      ...commentCreated(created, { id: video.id, title: video.title ?? '' }),
    });
    if (isErr(announced)) return announced;
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
  const job = { holdId: uuidv7(), commentId: held.id, videoId: held.videoId, recipients };
  const enqueued = await outboxRepo.enqueue(commentHeldOutbox(job));
  return isErr(enqueued) ? enqueued : ok();
}

import type { UserEventRepository } from '@vp/core/repositories';
import { type CommentThread, commentCreated, commentHeld, type NewCommentInput } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';

interface Announcement {
  created: CommentThread;
  video: { id: string; ownerId: string; title?: string | null } | null;
  input: Pick<NewCommentInput, 'authorId' | 'moderation' | 'moderators'>;
  /** Whether the comment landed in the public count. */
  counted: boolean;
}

/**
 * What the transaction of a new comment tells people: a public one reaches the video owner, a
 * held one reaches the moderators the service named.
 */
export async function announceCreated(
  events: Pick<UserEventRepository, 'append'>,
  { created, video, input, counted }: Announcement
): Promise<Result<void, DatabaseUnavailable>> {
  if (counted && video && video.ownerId !== input.authorId) {
    const announced = await events.append({
      userId: video.ownerId,
      ...commentCreated(created, { id: video.id, title: video.title ?? '' }),
    });
    if (isErr(announced)) return announced;
  }

  if (input.moderation?.moderationState === 'held') {
    for (const userId of input.moderators ?? []) {
      if (userId === input.authorId) continue;
      const told = await events.append({ userId, ...commentHeld(created) });
      if (isErr(told)) return told;
    }
  }
  return ok();
}

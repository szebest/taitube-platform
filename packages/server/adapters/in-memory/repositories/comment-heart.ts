import type { OutboxRepository } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { heartOutbox } from '@vp/job-contracts';
import { isErr, ok, type Result } from '@vp/result';
import type { StoredComment } from './comment-visibility';

/** The first heart enqueues the author's notification; hearting again, or taking it back, does not. */
export async function applyHeart(
  outbox: Pick<OutboxRepository, 'enqueue'>,
  comment: StoredComment,
  hearted: boolean
): Promise<Result<void, DatabaseUnavailable>> {
  if (!hearted) {
    comment.heartedAt = null;
    return ok();
  }
  if (comment.heartedAt !== null) return ok();

  comment.heartedAt = new Date();
  const enqueued = await outbox.enqueue(
    heartOutbox({ videoId: comment.videoId, commentId: comment.id })
  );
  return isErr(enqueued) ? enqueued : ok();
}

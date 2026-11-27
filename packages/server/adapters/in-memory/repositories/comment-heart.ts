import type { DatabaseUnavailable } from '@kit/errors';
import { isErr, ok, type Result } from '@kit/result';
import type { OutboxRepository } from '@vp/core/repositories';
import { heartOutbox } from '@vp/job-contracts';
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

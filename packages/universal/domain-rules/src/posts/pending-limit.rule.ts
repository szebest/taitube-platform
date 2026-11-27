import { type Result, err, ok } from '@kit/result';
import { POSTS_PENDING_LIMIT } from '@vp/domain';
import { type PostDraftLimit, postDraftLimit } from './failures';

export function decidePostPendingLimit(pending: number): Result<void, PostDraftLimit> {
  return pending >= POSTS_PENDING_LIMIT ? err(postDraftLimit(POSTS_PENDING_LIMIT)) : ok(undefined);
}

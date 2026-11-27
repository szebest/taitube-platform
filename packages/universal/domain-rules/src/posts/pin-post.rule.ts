import { type Result, err, ok } from '@kit/result';
import { POSTS_PINNED_LIMIT } from '@vp/domain';
import { type PostPinLimit, postPinLimit } from './failures';

export function decidePostPinLimit(pinned: number): Result<void, PostPinLimit> {
  return pinned >= POSTS_PINNED_LIMIT ? err(postPinLimit(POSTS_PINNED_LIMIT)) : ok(undefined);
}

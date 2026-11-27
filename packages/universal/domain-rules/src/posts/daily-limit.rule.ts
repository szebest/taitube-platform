import { type Result, err, ok } from '@kit/result';
import { POSTS_PER_DAY } from '@vp/domain';
import { type PostDailyLimit, postDailyLimit } from './failures';

export function decidePostDailyLimit(createdToday: number): Result<void, PostDailyLimit> {
  return createdToday >= POSTS_PER_DAY ? err(postDailyLimit(POSTS_PER_DAY)) : ok(undefined);
}

import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, isErr, ok } from '@kit/result';
import type { ChannelUserRestrictionRepositoryPort } from '@vp/core/repositories';
import { type CommentsBanned, commentsBanned } from '@vp/domain-rules';

export interface ChannelBanLookups {
  restrictions: Pick<ChannelUserRestrictionRepositoryPort, 'findActive'>;
}

/**
 * A visible ban on the channel a video is on refuses the user's writes on it. A shadow ban takes
 * no part: the write succeeds, which is what keeps it silent.
 */
export async function refuseWhileBanned(
  lookups: ChannelBanLookups,
  channelId: string,
  userId: string,
  now: Date
): Promise<Result<void, CommentsBanned | DatabaseUnavailable>> {
  const restriction = await lookups.restrictions.findActive(channelId, userId, now);
  if (isErr(restriction)) return restriction;
  return restriction.value?.kind === 'ban' ? err(commentsBanned(restriction.value)) : ok();
}

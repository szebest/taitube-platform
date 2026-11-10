import type {
  ChannelRepositoryPort,
  ChannelUserRestrictionRepositoryPort,
} from '@vp/core/repositories';
import { type CommentsBanned, commentsBanned } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, err, isErr, ok } from '@vp/result';

export interface ChannelBanLookups {
  channels: Pick<ChannelRepositoryPort, 'findByUserId'>;
  restrictions: Pick<ChannelUserRestrictionRepositoryPort, 'findActive'>;
}

/**
 * A visible ban on the channel that owns a video refuses the user's writes on it. A shadow ban
 * takes no part: the write succeeds, which is what keeps it silent.
 */
export async function refuseWhileBanned(
  lookups: ChannelBanLookups,
  videoOwnerId: string,
  userId: string,
  now: Date
): Promise<Result<void, CommentsBanned | DatabaseUnavailable>> {
  const channel = await lookups.channels.findByUserId(videoOwnerId);
  if (isErr(channel)) return channel;
  if (!channel.value) return ok();

  const restriction = await lookups.restrictions.findActive(channel.value.id, userId, now);
  if (isErr(restriction)) return restriction;
  return restriction.value?.kind === 'ban' ? err(commentsBanned(restriction.value)) : ok();
}

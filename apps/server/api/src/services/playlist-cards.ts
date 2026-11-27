import { map } from '@kit/result';
import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { type ChannelCard, toChannelCard } from '@vp/domain';

/** Each user's primary channel card, keyed by user id, as a playlist shows the people on it. */
export async function primaryCards(
  channels: Pick<ChannelRepositoryPort, 'findPrimaryByUserIds'>,
  userIds: readonly string[]
) {
  return map(
    await channels.findPrimaryByUserIds([...new Set(userIds)]),
    (found): ReadonlyMap<string, ChannelCard> =>
      new Map(found.map((channel) => [channel.userId, toChannelCard(channel)]))
  );
}

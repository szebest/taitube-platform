import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, map } from '@kit/result';
import type { SubscriptionRepositoryPort } from '@vp/core/repositories';

/** Whether any channel of the account follows `channelId`: what a subscriber-only gate asks. */
export async function followsChannel(
  subscriptions: Pick<SubscriptionRepositoryPort, 'getUserSubscriptionChannelIds'>,
  userId: string,
  channelId: string
): Promise<Result<boolean, DatabaseUnavailable>> {
  const followed = await subscriptions.getUserSubscriptionChannelIds(userId);
  return map(followed, (channelIds) => channelIds.includes(channelId));
}

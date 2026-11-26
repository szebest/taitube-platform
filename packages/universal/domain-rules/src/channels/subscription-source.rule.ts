import type { Channel, Video } from '@vp/domain';

/**
 * The video a subscription is credited to: only a public video of the channel being subscribed to.
 * Anything else, a forged id included, is dropped without a failure, because the subscription itself is fine.
 */
export function subscriptionSourceOf(
  channel: Pick<Channel, 'id'>,
  video: Pick<Video, 'id' | 'channelId' | 'visibility'> | null
): string | null {
  return video && video.channelId === channel.id && video.visibility === 'public' ? video.id : null;
}

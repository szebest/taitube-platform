import type {
  ChannelSubscription,
  SubscribedChannelItem,
  SubscriptionChangeResult,
} from '../domain/subscription';
import type { VideoRecord } from './video-repository';

export type { ChannelSubscription, SubscribedChannelItem, SubscriptionChangeResult };

export interface SubscriptionFeedOptions {
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface ListSubscriptionsOptions {
  cursor?: { createdAt: Date; channelId: string };
  limit: number;
}

/**
 * Paginating methods return up to `limit + 1` rows so the caller can detect a
 * further page and mint the opaque cursor; encoding it is a transport concern.
 */
export interface SubscriptionRepositoryPort {
  subscribe(subscriberId: string, channelId: string): Promise<SubscriptionChangeResult>;
  unsubscribe(subscriberId: string, channelId: string): Promise<SubscriptionChangeResult>;
  isSubscribed(subscriberId: string, channelId: string): Promise<boolean>;
  getUserSubscriptionChannelIds(subscriberId: string): Promise<string[]>;
  listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<SubscribedChannelItem[]>;
  getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<{ items: VideoRecord[]; total: number }>;
  getSubscriberCount(channelId: string): Promise<number>;
}


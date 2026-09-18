import type {
  ChannelSubscription,
  SubscribedChannelItem,
  SubscribeResult,
  UnsubscribeResult,
} from '../domain/subscription';
import type { VideoRecord } from './video-repository';

export type {
  ChannelSubscription,
  SubscribedChannelItem,
  SubscribeResult,
  UnsubscribeResult,
};

export interface SubscriptionFeedOptions {
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface ListSubscriptionsOptions {
  cursor?: { createdAt: Date; channelId: string };
  limit: number;
}

export interface SubscriptionRepositoryPort {
  subscribe(subscriberId: string, channelId: string): Promise<SubscribeResult>;
  unsubscribe(subscriberId: string, channelId: string): Promise<UnsubscribeResult>;
  isSubscribed(subscriberId: string, channelId: string): Promise<boolean>;
  getUserSubscriptionChannelIds(subscriberId: string): Promise<string[]>;
  listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<{ items: SubscribedChannelItem[]; nextCursor: string | null }>;
  getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<{ items: VideoRecord[]; nextCursor: string | null; total: number }>;
  getSubscriberCount(channelId: string): Promise<number>;
}

export type SubscriptionRepository = SubscriptionRepositoryPort;

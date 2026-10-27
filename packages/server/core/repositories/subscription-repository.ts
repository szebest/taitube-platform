import type {
  ChannelSubscriber,
  NotificationLevel,
  SubscribedChannelItem,
  SubscriptionChangeResult,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { VideoRecord } from './video-repository';

export interface SubscriptionFeedOptions {
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface ListSubscribersOptions {
  /** Subscribers are walked in id order; this is the last one of the previous batch. */
  after?: string;
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
  subscribe(
    subscriberId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>>;
  unsubscribe(
    subscriberId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>>;
  isSubscribed(
    subscriberId: string,
    channelId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  getUserSubscriptionChannelIds(
    subscriberId: string
  ): Promise<Result<string[], DatabaseUnavailable>>;
  listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<Result<SubscribedChannelItem[], DatabaseUnavailable>>;
  getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<Result<{ items: VideoRecord[]; total: number }, DatabaseUnavailable>>;
  /** `false` when the caller is not subscribed, and nothing was written. */
  setNotificationLevel(
    subscriberId: string,
    channelId: string,
    level: NotificationLevel
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Up to `limit` subscribers after `after`, for a fan-out that walks the channel in batches. */
  listSubscribers(
    channelId: string,
    options: ListSubscribersOptions
  ): Promise<Result<ChannelSubscriber[], DatabaseUnavailable>>;
  getSubscriberCount(channelId: string): Promise<Result<number, DatabaseUnavailable>>;
}

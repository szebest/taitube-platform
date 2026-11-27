import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type {
  ChannelSubscriber,
  NewChannelAuditEntry,
  NotificationLevel,
  SubscribedChannelItem,
  SubscriptionChangeResult,
  ViewDateRange,
} from '@vp/domain';
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
  /** `sourceVideoId` and `audit` are written only by the call that creates the subscription. */
  subscribe(
    subscriberId: string,
    subscriberChannelId: string,
    channelId: string,
    sourceVideoId?: string | null,
    audit?: NewChannelAuditEntry
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>>;
  unsubscribe(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>>;
  isSubscribed(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  getChannelSubscriptionChannelIds(
    subscriberChannelId: string
  ): Promise<Result<string[], DatabaseUnavailable>>;
  /** The account-wide reads below name each channel once, however many of the account's channels subscribe to it. */
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
    subscriberChannelId: string,
    channelId: string,
    level: NotificationLevel
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /**
   * Up to `limit` subscribing accounts after `after`, for a fan-out that walks the channel in
   * batches; an account subscribed from two channels is listed once, at its loudest level.
   */
  listSubscribers(
    channelId: string,
    options: ListSubscribersOptions
  ): Promise<Result<ChannelSubscriber[], DatabaseUnavailable>>;
  getSubscriberCount(channelId: string): Promise<Result<number, DatabaseUnavailable>>;
  /** Subscriptions that exist now and were made from `videoId`'s watch page: a net count, an unsubscribe leaves it. */
  countFromVideo(videoId: string): Promise<Result<number, DatabaseUnavailable>>;
  /** Gains minus losses of the channel over the days of `range`, UTC. */
  netSubscribers(
    channelId: string,
    range: ViewDateRange
  ): Promise<Result<number, DatabaseUnavailable>>;
}

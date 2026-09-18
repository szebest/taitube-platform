import type {
  ChannelRepositoryPort,
  SubscriptionCachePort,
  SubscriptionRepositoryPort,
} from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { AuthUser } from '../plugins/auth';
import { decodeSubscriptionCursor, decodeVideoCursor } from './cursor';
import { type VideoSummaryView, toVideoSummaryView } from './types';

export interface SubscriptionServiceOptions {
  subscriptions: SubscriptionRepositoryPort;
  channels: ChannelRepositoryPort;
  subscriptionCache?: SubscriptionCachePort;
  cdnBaseUrl?: string;
}

export class SubscriptionService {
  private readonly subscriptions: SubscriptionRepositoryPort;
  private readonly channels: ChannelRepositoryPort;
  private readonly subscriptionCache?: SubscriptionCachePort;
  private readonly cleanCdnBase: string;

  constructor(options: SubscriptionServiceOptions) {
    this.subscriptions = options.subscriptions;
    this.channels = options.channels;
    this.subscriptionCache = options.subscriptionCache;
    this.cleanCdnBase = (options.cdnBaseUrl ?? '').replace(/\/+$/, '');
  }

  async subscribe(
    user: AuthUser,
    channelId: string
  ): Promise<{ channelId: string; subscribed: boolean; subscriberCount: number }> {
    const result = await this.subscriptions.subscribe(user.id, channelId);
    if (this.subscriptionCache) {
      await this.subscriptionCache.addSubscription(user.id, channelId);
      await this.subscriptionCache.setSubscriberCount(channelId, result.subscriberCount);
    }
    return {
      channelId,
      subscribed: true,
      subscriberCount: result.subscriberCount,
    };
  }

  async unsubscribe(
    user: AuthUser,
    channelId: string
  ): Promise<{ channelId: string; subscribed: boolean; subscriberCount: number }> {
    const result = await this.subscriptions.unsubscribe(user.id, channelId);
    if (this.subscriptionCache) {
      await this.subscriptionCache.removeSubscription(user.id, channelId);
      await this.subscriptionCache.setSubscriberCount(channelId, result.subscriberCount);
    }
    return {
      channelId,
      subscribed: false,
      subscriberCount: result.subscriberCount,
    };
  }

  async isSubscribed(
    user: AuthUser,
    channelId: string
  ): Promise<{ channelId: string; subscribed: boolean }> {
    const channel = await this.channels.findById(channelId);
    if (!channel) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');
    }

    if (this.subscriptionCache) {
      const cached = await this.subscriptionCache.isSubscribed(user.id, channelId);
      if (cached !== null) {
        return { channelId, subscribed: cached };
      }
    }

    const subscribed = await this.subscriptions.isSubscribed(user.id, channelId);

    if (this.subscriptionCache) {
      const allSubscribed = await this.subscriptions.getUserSubscriptionChannelIds(user.id);
      await this.subscriptionCache.setUserSubscriptions(user.id, allSubscribed);
    }

    return { channelId, subscribed };
  }

  async listSubscriptions(
    user: AuthUser,
    options: { cursor?: string; limit?: number }
  ): Promise<{
    items: Array<{
      id: string;
      userId: string;
      handle: string;
      displayName: string;
      avatarUrl: string | null;
      bannerUrl: string | null;
      bio: string | null;
      subscriberCount: number;
      subscribedAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const decodedCursor = decodeSubscriptionCursor(options.cursor);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const result = await this.subscriptions.listUserSubscriptions(user.id, {
      cursor: decodedCursor ?? undefined,
      limit,
    });

    const items = result.items.map((item) => ({
      ...item,
      subscribedAt:
        item.subscribedAt instanceof Date
          ? item.subscribedAt.toISOString()
          : String(item.subscribedAt),
    }));

    return {
      items,
      nextCursor: result.nextCursor,
    };
  }

  async getFeed(
    user: AuthUser,
    options: { cursor?: string; limit?: number }
  ): Promise<{ items: VideoSummaryView[]; nextCursor: string | null; total: number }> {
    const decodedCursor = decodeVideoCursor(options.cursor);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const result = await this.subscriptions.getSubscriptionFeed(user.id, {
      cursor: decodedCursor ?? undefined,
      limit,
    });

    const items = result.items.map((v) => toVideoSummaryView(v, this.cleanCdnBase));

    return {
      items,
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }
}

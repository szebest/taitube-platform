import { CaslAuthorizationAdapter } from '@vp/adapters';
import type { SubscribedChannelItem } from '@vp/domain';
import { type Paginator, defaultPaginator } from '@vp/pagination';
import type { AuthorizationPort, SubscriptionCachePort } from '@vp/core/ports';
import type { ChannelRepositoryPort, SubscriptionRepositoryPort } from '@vp/core/repositories';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { isErr } from '@vp/result';
import { canSubscribeChannel } from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';
import {
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeSubscriptionCursor,
  subscriptionCursorPayload,
} from './cursor';
import { type VideoSummaryView, toVideoSummaryView } from './video-views';

export type SubscribedChannelView = Omit<SubscribedChannelItem, 'subscribedAt'> & {
  subscribedAt: string;
};

export interface SubscriptionStatusView {
  channelId: string;
  subscribed: boolean;
  subscriberCount: number;
}

export interface SubscriptionServiceOptions {
  subscriptions: SubscriptionRepositoryPort;
  channels: ChannelRepositoryPort;
  subscriptionCache?: SubscriptionCachePort;
  cdnBaseUrl?: string;
  paginator?: Paginator;
  authorization?: AuthorizationPort;
}

export class SubscriptionService {
  private readonly subscriptions: SubscriptionRepositoryPort;
  private readonly channels: ChannelRepositoryPort;
  private readonly subscriptionCache?: SubscriptionCachePort;
  private readonly cleanCdnBase: string;
  private readonly paginator: Paginator;
  private readonly auth: AuthorizationPort;

  constructor(options: SubscriptionServiceOptions) {
    this.subscriptions = options.subscriptions;
    this.channels = options.channels;
    this.subscriptionCache = options.subscriptionCache;
    this.cleanCdnBase = (options.cdnBaseUrl ?? '').replace(/\/+$/, '');
    this.paginator = options.paginator ?? defaultPaginator;
    this.auth = options.authorization ?? new CaslAuthorizationAdapter();
  }

  private assertMaySubscribe(user: AuthUser): void {
    this.auth.assertCan(
      canSubscribeChannel,
      { user: user },
      {
        action: 'subscribe',
        subject: 'Channel',
        user: user,
        message: 'Your role is not allowed to subscribe to channels',
      }
    );
  }

  async subscribe(user: AuthUser, channelId: string): Promise<SubscriptionStatusView> {
    this.assertMaySubscribe(user);
    const { subscriberCount, changed } = await this.subscriptions.subscribe(user.id, channelId);
    if (changed) {
      await this.subscriptionCache?.addSubscription(user.id, channelId);
      await this.subscriptionCache?.setSubscriberCount(channelId, subscriberCount);
    }
    return { channelId, subscribed: true, subscriberCount };
  }

  async unsubscribe(user: AuthUser, channelId: string): Promise<SubscriptionStatusView> {
    this.assertMaySubscribe(user);
    const { subscriberCount, changed } = await this.subscriptions.unsubscribe(user.id, channelId);
    if (changed) {
      await this.subscriptionCache?.removeSubscription(user.id, channelId);
      await this.subscriptionCache?.setSubscriberCount(channelId, subscriberCount);
    }
    return { channelId, subscribed: false, subscriberCount };
  }

  async isSubscribed(
    user: AuthUser,
    channelId: string
  ): Promise<{ channelId: string; subscribed: boolean }> {
    const channel = await this.channels.findById(channelId);
    if (isErr(channel)) throw new TransientError(channel.error.code, channel.error.message);
    if (!channel.value) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');
    }

    const cached = await this.subscriptionCache?.isSubscribed(user.id, channelId);
    if (cached !== null && cached !== undefined) {
      return { channelId, subscribed: cached };
    }

    // On a miss, prime the whole set: one query answers this call and every
    // later one, instead of a point lookup that leaves the cache still cold.
    const channelIds = await this.subscriptions.getUserSubscriptionChannelIds(user.id);
    await this.subscriptionCache?.setUserSubscriptions(user.id, channelIds);
    return { channelId, subscribed: channelIds.includes(channelId) };
  }

  async listSubscriptions(
    user: AuthUser,
    options: { cursor?: string; limit?: number }
  ): Promise<{ items: SubscribedChannelView[]; nextCursor: string | null }> {
    const limit = this.paginator.limit(options.limit);
    const rows = await this.subscriptions.listUserSubscriptions(user.id, {
      cursor: decodeSubscriptionCursor(options.cursor, this.paginator) ?? undefined,
      limit,
    });

    return this.paginator.paginate(rows, limit, {
      cursorOf: (row) =>
        subscriptionCursorPayload({ createdAt: row.subscribedAt, channelId: row.id }),
      toItem: (row) => ({ ...row, subscribedAt: row.subscribedAt.toISOString() }),
    });
  }

  async getFeed(
    user: AuthUser,
    options: { cursor?: string; limit?: number }
  ): Promise<{ items: VideoSummaryView[]; nextCursor: string | null; total: number }> {
    const limit = this.paginator.limit(options.limit);
    const { items: rows, total } = await this.subscriptions.getSubscriptionFeed(user.id, {
      cursor: decodeCreatedAtCursor(options.cursor, this.paginator) ?? undefined,
      limit,
    });

    const page = this.paginator.paginate(rows, limit, {
      cursorOf: createdAtCursorPayload,
      toItem: (video) => toVideoSummaryView(video, this.cleanCdnBase),
    });

    return { ...page, total };
  }
}

import type { SubscriptionCachePort } from '@vp/core/ports';
import type { ChannelRepositoryPort, SubscriptionRepositoryPort } from '@vp/core/repositories';
import type { SubscribedChannelItem } from '@vp/domain';
import {
  type SubscribeFailure,
  type UnsubscribeFailure,
  decideSubscribe,
  decideUnsubscribe,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Paginator, defaultPaginator } from '@vp/pagination';
import { type Result, isErr, map, ok, unwrapOr } from '@vp/result';
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
}

export type SubscribeServiceFailure = SubscribeFailure | DatabaseUnavailable;
export type UnsubscribeServiceFailure = UnsubscribeFailure | DatabaseUnavailable;
export type ReadSubscriptionFailure = UnsubscribeFailure | DatabaseUnavailable;

export class SubscriptionService {
  private readonly subscriptions: SubscriptionRepositoryPort;
  private readonly channels: ChannelRepositoryPort;
  private readonly subscriptionCache?: SubscriptionCachePort;
  private readonly cleanCdnBase: string;
  private readonly paginator: Paginator;

  constructor(options: SubscriptionServiceOptions) {
    this.subscriptions = options.subscriptions;
    this.channels = options.channels;
    this.subscriptionCache = options.subscriptionCache;
    this.cleanCdnBase = (options.cdnBaseUrl ?? '').replace(/\/+$/, '');
    this.paginator = options.paginator ?? defaultPaginator;
  }

  /**
   * `CacheUnavailable` is absent from every signature here on purpose: a dead cache costs a query,
   * not an answer, so this service handles it rather than passing it on.
   */
  async subscribe(
    user: AuthUser,
    channelId: string
  ): Promise<Result<SubscriptionStatusView, SubscribeServiceFailure>> {
    const found = await this.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideSubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const written = await this.subscriptions.subscribe(user.id, channelId);
    if (isErr(written)) return written;

    const { subscriberCount, changed } = written.value;
    if (changed) {
      await this.subscriptionCache?.addSubscription(user.id, channelId);
      await this.subscriptionCache?.setSubscriberCount(channelId, subscriberCount);
    }
    return ok({ channelId, subscribed: true, subscriberCount });
  }

  async unsubscribe(
    user: AuthUser,
    channelId: string
  ): Promise<Result<SubscriptionStatusView, UnsubscribeServiceFailure>> {
    const found = await this.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideUnsubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const written = await this.subscriptions.unsubscribe(user.id, channelId);
    if (isErr(written)) return written;

    const { subscriberCount, changed } = written.value;
    if (changed) {
      await this.subscriptionCache?.removeSubscription(user.id, channelId);
      await this.subscriptionCache?.setSubscriberCount(channelId, subscriberCount);
    }
    return ok({ channelId, subscribed: false, subscriberCount });
  }

  async isSubscribed(
    user: AuthUser,
    channelId: string
  ): Promise<Result<{ channelId: string; subscribed: boolean }, ReadSubscriptionFailure>> {
    const found = await this.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideUnsubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const cached = this.subscriptionCache
      ? unwrapOr(await this.subscriptionCache.isSubscribed(user.id, channelId), null)
      : null;
    if (cached !== null) return ok({ channelId, subscribed: cached });

    // On a miss, prime the whole set: one query answers this call and every
    // later one, instead of a point lookup that leaves the cache still cold.
    const channelIds = await this.subscriptions.getUserSubscriptionChannelIds(user.id);
    if (isErr(channelIds)) return channelIds;

    await this.subscriptionCache?.setUserSubscriptions(user.id, channelIds.value);
    return ok({ channelId, subscribed: channelIds.value.includes(channelId) });
  }

  async listSubscriptions(
    user: AuthUser,
    options: { cursor?: string; limit?: number }
  ): Promise<
    Result<{ items: SubscribedChannelView[]; nextCursor: string | null }, DatabaseUnavailable>
  > {
    const limit = this.paginator.limit(options.limit);
    const rows = await this.subscriptions.listUserSubscriptions(user.id, {
      cursor: decodeSubscriptionCursor(options.cursor, this.paginator) ?? undefined,
      limit,
    });

    return map(rows, (found) =>
      this.paginator.paginate(found, limit, {
        cursorOf: (row) =>
          subscriptionCursorPayload({ createdAt: row.subscribedAt, channelId: row.id }),
        toItem: (row) => ({ ...row, subscribedAt: row.subscribedAt.toISOString() }),
      })
    );
  }

  async getFeed(
    user: AuthUser,
    options: { cursor?: string; limit?: number }
  ): Promise<
    Result<
      { items: VideoSummaryView[]; nextCursor: string | null; total: number },
      DatabaseUnavailable
    >
  > {
    const limit = this.paginator.limit(options.limit);
    const feed = await this.subscriptions.getSubscriptionFeed(user.id, {
      cursor: decodeCreatedAtCursor(options.cursor, this.paginator) ?? undefined,
      limit,
    });

    return map(feed, ({ items: rows, total }) => ({
      ...this.paginator.paginate(rows, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (video) => toVideoSummaryView(video, this.cleanCdnBase),
      }),
      total,
    }));
  }
}

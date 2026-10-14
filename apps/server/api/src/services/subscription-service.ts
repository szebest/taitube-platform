import type { SubscriptionCachePort } from '@vp/core/ports';
import type { ChannelRepositoryPort, SubscriptionRepositoryPort } from '@vp/core/repositories';
import type { SubscribedChannelItem } from '@vp/domain';
import {
  type SubscribeFailure,
  type UnsubscribeFailure,
  decideSubscribe,
  decideUnsubscribe,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, ignore, isErr, map, ok, unwrapOr } from '@vp/result';
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

export interface SubscriptionServiceDeps {
  subscriptions: SubscriptionRepositoryPort;
  channels: ChannelRepositoryPort;
  subscriptionCache: SubscriptionCachePort;
  cdn: CdnBase;
  paginator: Paginator;
}

export type SubscribeServiceFailure = SubscribeFailure | DatabaseUnavailable;
export type UnsubscribeServiceFailure = UnsubscribeFailure | DatabaseUnavailable;
export type ReadSubscriptionFailure = UnsubscribeFailure | DatabaseUnavailable;

export class SubscriptionService {
  constructor(private readonly deps: SubscriptionServiceDeps) {}

  /**
   * `CacheUnavailable` is absent from every signature here on purpose: a dead cache costs a query,
   * not an answer, so this service handles it rather than passing it on.
   */
  async subscribe(
    user: UserContext,
    channelId: string
  ): Promise<Result<SubscriptionStatusView, SubscribeServiceFailure>> {
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideSubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const written = await this.deps.subscriptions.subscribe(user.id, channelId);
    if (isErr(written)) return written;

    const { subscriberCount, changed } = written.value;
    if (changed) {
      ignore(
        await this.deps.subscriptionCache.addSubscription(user.id, channelId),
        'the subscription is written; the cache heals on its TTL'
      );
      ignore(
        await this.deps.subscriptionCache.setSubscriberCount(channelId, subscriberCount),
        'the count is written; the cache heals on its TTL'
      );
    }
    return ok({ channelId, subscribed: true, subscriberCount });
  }

  async unsubscribe(
    user: UserContext,
    channelId: string
  ): Promise<Result<SubscriptionStatusView, UnsubscribeServiceFailure>> {
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideUnsubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const written = await this.deps.subscriptions.unsubscribe(user.id, channelId);
    if (isErr(written)) return written;

    const { subscriberCount, changed } = written.value;
    if (changed) {
      ignore(
        await this.deps.subscriptionCache.removeSubscription(user.id, channelId),
        'the unsubscription is written; the cache heals on its TTL'
      );
      ignore(
        await this.deps.subscriptionCache.setSubscriberCount(channelId, subscriberCount),
        'the count is written; the cache heals on its TTL'
      );
    }
    return ok({ channelId, subscribed: false, subscriberCount });
  }

  async isSubscribed(
    user: UserContext,
    channelId: string
  ): Promise<Result<{ channelId: string; subscribed: boolean }, ReadSubscriptionFailure>> {
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideUnsubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const cached = unwrapOr(
      await this.deps.subscriptionCache.isSubscribed(user.id, channelId),
      null
    );
    if (cached !== null) return ok({ channelId, subscribed: cached });

    // On a miss, prime the whole set: one query answers this call and every
    // later one, instead of a point lookup that leaves the cache still cold.
    const channelIds = await this.deps.subscriptions.getUserSubscriptionChannelIds(user.id);
    if (isErr(channelIds)) return channelIds;

    ignore(
      await this.deps.subscriptionCache.setUserSubscriptions(user.id, channelIds.value),
      'the set was read; a cold cache costs the next call one query'
    );
    return ok({ channelId, subscribed: channelIds.value.includes(channelId) });
  }

  async listSubscriptions(
    user: UserContext,
    options: { cursor?: string; limit?: number }
  ): Promise<
    Result<
      { items: SubscribedChannelView[]; nextCursor: string | null },
      DatabaseUnavailable | InvalidCursor
    >
  > {
    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeSubscriptionCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.subscriptions.listUserSubscriptions(user.id, {
      cursor: cursor.value ?? undefined,
      limit,
    });

    return map(rows, (found) =>
      this.deps.paginator.paginate(found, limit, {
        cursorOf: (row) =>
          subscriptionCursorPayload({ createdAt: row.subscribedAt, channelId: row.id }),
        toItem: (row) => ({ ...row, subscribedAt: row.subscribedAt.toISOString() }),
      })
    );
  }

  async getFeed(
    user: UserContext,
    options: { cursor?: string; limit?: number }
  ): Promise<
    Result<
      { items: VideoSummaryView[]; nextCursor: string | null; total: number },
      DatabaseUnavailable | InvalidCursor
    >
  > {
    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const feed = await this.deps.subscriptions.getSubscriptionFeed(user.id, {
      cursor: cursor.value ?? undefined,
      limit,
    });

    return map(feed, ({ items: rows, total }) => ({
      ...this.deps.paginator.paginate(rows, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (video) => toVideoSummaryView(video, this.deps.cdn),
      }),
      total,
    }));
  }
}

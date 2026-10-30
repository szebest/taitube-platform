import type { SubscriptionCachePort } from '@vp/core/ports';
import type { ChannelRepositoryPort, SubscriptionRepositoryPort } from '@vp/core/repositories';
import type { NotificationLevel, SubscribedChannelItem } from '@vp/domain';
import {
  channelNotFound,
  decideSubscribe,
  decideUnsubscribe,
  type SubscribeFailure,
  type UnsubscribeFailure,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { err, ignore, isErr, map, ok, type Result, unwrapOr } from '@vp/result';
import {
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeSubscriptionCursor,
  subscriptionCursorPayload,
} from './cursor';
import type { HomeService } from './home-service';
import {
  loadChannelsOf,
  type SpriteGeometry,
  toVideoSummaryView,
  type VideoSummaryView,
} from './video-views';
import type { ViewerProgress } from './viewer-progress';

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
  home: Pick<HomeService, 'forget'>;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  paginator: Paginator;
  viewerProgress: ViewerProgress;
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
      await this.deps.home.forget(user.id);
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
      await this.deps.home.forget(user.id);
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

  async setNotificationLevel(
    user: UserContext,
    channelId: string,
    level: NotificationLevel
  ): Promise<Result<{ channelId: string; level: NotificationLevel }, ReadSubscriptionFailure>> {
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideUnsubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const written = await this.deps.subscriptions.setNotificationLevel(user.id, channelId, level);
    if (isErr(written)) return written;

    return written.value ? ok({ channelId, level }) : err(channelNotFound(channelId));
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

    if (isErr(feed)) return feed;

    const { items, total } = feed.value;
    const channelOf = await loadChannelsOf(
      this.deps.channels,
      items.map((video) => video.ownerId)
    );
    if (isErr(channelOf)) return channelOf;

    const page = this.deps.paginator.paginate(items, limit, {
      cursorOf: createdAtCursorPayload,
      toItem: (video) =>
        toVideoSummaryView(video, this.deps.cdn, this.deps.sprite, channelOf.value(video.ownerId)),
    });
    return ok({
      ...page,
      items: await this.deps.viewerProgress.attach(user, page.items),
      total,
    });
  }
}

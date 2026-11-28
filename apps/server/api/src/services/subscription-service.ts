import type { DatabaseUnavailable } from '@kit/errors';
import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, err, ignore, isErr, map, ok, unwrapOr } from '@kit/result';
import type { SubscriptionCachePort } from '@vp/core/ports';
import type {
  ChannelRepositoryPort,
  SubscriptionRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import type { ActingChannel, Channel, NotificationLevel, SubscribedChannelItem } from '@vp/domain';
import {
  type AuthorizationFailure,
  type SubscribeFailure,
  type UnsubscribeFailure,
  channelNotFound,
  decideChannelTask,
  decideSubscribe,
  decideUnsubscribe,
  subscriptionSourceOf,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { auditActor } from './audit-actor';
import {
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeSubscriptionCursor,
  subscriptionCursorPayload,
} from './cursor';
import type { HomeService } from './home-service';
import {
  type SpriteGeometry,
  type VideoSummaryView,
  loadChannelsOf,
  toVideoSummaryView,
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
  videos: VideoRepository;
  subscriptionCache: SubscriptionCachePort;
  home: Pick<HomeService, 'forget'>;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  paginator: Paginator;
  viewerProgress: ViewerProgress;
}

export type SubscribeServiceFailure = AuthorizationFailure | SubscribeFailure | DatabaseUnavailable;
export type UnsubscribeServiceFailure =
  | AuthorizationFailure
  | UnsubscribeFailure
  | DatabaseUnavailable;
export type ReadSubscriptionFailure = UnsubscribeFailure | DatabaseUnavailable;

/**
 * `CacheUnavailable` is absent from every signature here on purpose: a dead cache costs a query,
 * not an answer, so this service handles it rather than passing it on.
 */
export class SubscriptionService {
  constructor(private readonly deps: SubscriptionServiceDeps) {}

  /** Subscribes the acting channel; a new subscription lands in that channel's audit log. */
  async subscribe(
    user: UserContext,
    acting: ActingChannel,
    channelId: string,
    fromVideoId?: string
  ): Promise<Result<SubscriptionStatusView, SubscribeServiceFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'subscribe-as' });
    if (isErr(allowed)) return allowed;
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideSubscribe({
      subscriber: user,
      channel: found.value,
      channelId,
      subscriberChannelId: acting.channelId,
    });
    if (isErr(decided)) return decided;

    const source = fromVideoId ? await this.deps.videos.findById(fromVideoId) : ok(null);
    if (isErr(source)) return source;

    const written = await this.deps.subscriptions.subscribe(
      user.id,
      acting.channelId,
      channelId,
      subscriptionSourceOf(decided.value, source.value),
      {
        channelId: acting.channelId,
        ...auditActor(user),
        action: 'channel.subscribed',
        targetType: 'channel',
        targetId: channelId,
        meta: {},
      }
    );
    if (isErr(written)) return written;

    const { subscriberCount, changed } = written.value;
    if (changed) {
      await this.deps.home.forget(user.id);
      ignore(
        await this.deps.subscriptionCache.addSubscription(acting.channelId, channelId),
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
    acting: ActingChannel,
    channelId: string
  ): Promise<Result<SubscriptionStatusView, UnsubscribeServiceFailure>> {
    const decided = await this.decideAs(user, acting, channelId);
    if (isErr(decided)) return decided;

    const written = await this.deps.subscriptions.unsubscribe(acting.channelId, channelId);
    if (isErr(written)) return written;

    const { subscriberCount, changed } = written.value;
    if (changed) {
      await this.deps.home.forget(user.id);
      ignore(
        await this.deps.subscriptionCache.removeSubscription(acting.channelId, channelId),
        'the unsubscription is written; the cache heals on its TTL'
      );
      ignore(
        await this.deps.subscriptionCache.setSubscriberCount(channelId, subscriberCount),
        'the count is written; the cache heals on its TTL'
      );
    }
    return ok({ channelId, subscribed: false, subscriberCount });
  }

  /** Whether the acting channel follows `channelId`; another channel of the account may differ. */
  async isSubscribed(
    user: UserContext,
    acting: ActingChannel,
    channelId: string
  ): Promise<Result<{ channelId: string; subscribed: boolean }, ReadSubscriptionFailure>> {
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;

    const decided = decideUnsubscribe({ subscriber: user, channel: found.value, channelId });
    if (isErr(decided)) return decided;

    const cached = unwrapOr(
      await this.deps.subscriptionCache.isSubscribed(acting.channelId, channelId),
      null
    );
    if (cached !== null) return ok({ channelId, subscribed: cached });

    // On a miss, prime the whole set: one query answers this call and every
    // later one, instead of a point lookup that leaves the cache still cold.
    const channelIds = await this.deps.subscriptions.getChannelSubscriptionChannelIds(
      acting.channelId
    );
    if (isErr(channelIds)) return channelIds;

    ignore(
      await this.deps.subscriptionCache.setSubscriptions(acting.channelId, channelIds.value),
      'the set was read; a cold cache costs the next call one query'
    );
    return ok({ channelId, subscribed: channelIds.value.includes(channelId) });
  }

  async setNotificationLevel(
    user: UserContext,
    acting: ActingChannel,
    channelId: string,
    level: NotificationLevel
  ): Promise<Result<{ channelId: string; level: NotificationLevel }, UnsubscribeServiceFailure>> {
    const decided = await this.decideAs(user, acting, channelId);
    if (isErr(decided)) return decided;

    const written = await this.deps.subscriptions.setNotificationLevel(
      acting.channelId,
      channelId,
      level
    );
    if (isErr(written)) return written;

    return written.value ? ok({ channelId, level }) : err(channelNotFound(channelId));
  }

  /** A write on the acting channel's subscription to `channelId`, which must be there. */
  private async decideAs(
    user: UserContext,
    acting: ActingChannel,
    channelId: string
  ): Promise<Result<Channel, UnsubscribeServiceFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'subscribe-as' });
    if (isErr(allowed)) return allowed;
    const found = await this.deps.channels.findById(channelId);
    if (isErr(found)) return found;
    return decideUnsubscribe({ subscriber: user, channel: found.value, channelId });
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
      items.map((video) => video.channelId)
    );
    if (isErr(channelOf)) return channelOf;

    const page = this.deps.paginator.paginate(items, limit, {
      cursorOf: createdAtCursorPayload,
      toItem: (video) =>
        toVideoSummaryView(
          video,
          this.deps.cdn,
          this.deps.sprite,
          channelOf.value(video.channelId)
        ),
    });
    return ok({
      ...page,
      items: await this.deps.viewerProgress.attach(user, page.items),
      total,
    });
  }
}

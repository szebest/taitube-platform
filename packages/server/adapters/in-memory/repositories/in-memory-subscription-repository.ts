import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, isErr, ok, unwrapOr } from '@kit/result';
import type {
  ListSubscribersOptions,
  ListSubscriptionsOptions,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import {
  type ChannelSubscriber,
  type ChannelSubscription,
  type NewChannelAuditEntry,
  NOTIFICATION_LEVELS,
  type NotificationLevel,
  type SubscribedChannelItem,
  type SubscriptionChangeResult,
  type ViewDateRange,
  viewDateOf,
} from '@vp/domain';
import { uuidv7 } from 'uuidv7';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

export interface InMemorySubscriptionRepositoryOptions {
  channelsRepo: InMemoryChannelRepository;
  videosRepo: InMemoryVideoRepository;
  auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;
}

export class InMemorySubscriptionRepository implements SubscriptionRepositoryPort {
  private readonly subscriptions = new Map<string, ChannelSubscription>();
  private readonly events: { channelId: string; delta: 1 | -1; occurredAt: Date }[] = [];
  private readonly channelsRepo: InMemoryChannelRepository;
  private readonly videosRepo: InMemoryVideoRepository;
  private readonly auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;

  constructor(options: InMemorySubscriptionRepositoryOptions) {
    this.channelsRepo = options.channelsRepo;
    this.videosRepo = options.videosRepo;
    this.auditRepo = options.auditRepo;
  }

  private key(subscriberChannelId: string, channelId: string): string {
    return `${subscriberChannelId}:${channelId}`;
  }

  /**
   * A channel the write cannot find changed nothing, and has no subscribers to report. Whether an
   * absent channel is an error is the caller's rule, not this double's - it only says what happened,
   * and it says the same thing the Postgres adapter's transaction does.
   */
  private async findChannel(channelId: string) {
    return unwrapOr(await this.channelsRepo.findById(channelId), null);
  }

  /**
   * One await before the claim, the audit row's after it. The claim and the counter move together
   * with no yield between them, the way the Postgres adapter's transaction moves them, so ten
   * concurrent subscribes cannot observe a half-step - which is exactly what they did when the counter update sat behind its
   * own `await` and every loser reported zero.
   */
  async subscribe(
    subscriberId: string,
    subscriberChannelId: string,
    channelId: string,
    sourceVideoId: string | null = null,
    audit?: NewChannelAuditEntry
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>> {
    const channel = await this.findChannel(channelId);
    if (!channel) return ok({ subscriberCount: 0, changed: false });

    const key = this.key(subscriberChannelId, channelId);
    if (this.subscriptions.has(key)) {
      return ok({ subscriberCount: channel.subscriberCount, changed: false });
    }

    this.subscriptions.set(key, {
      id: uuidv7(),
      subscriberId,
      subscriberChannelId,
      channelId,
      notificationLevel: 'all',
      sourceVideoId,
      createdAt: new Date(),
    });
    channel.subscriberCount += 1;
    channel.updatedAt = new Date();
    this.events.push({ channelId, delta: 1, occurredAt: new Date() });
    if (audit) {
      const appended = await this.auditRepo.append(audit);
      if (isErr(appended)) return appended;
    }
    return ok({ subscriberCount: channel.subscriberCount, changed: true });
  }

  async unsubscribe(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>> {
    const channel = await this.findChannel(channelId);
    if (!channel) return ok({ subscriberCount: 0, changed: false });

    const key = this.key(subscriberChannelId, channelId);
    if (!this.subscriptions.delete(key)) {
      return ok({ subscriberCount: channel.subscriberCount, changed: false });
    }

    channel.subscriberCount = Math.max(0, channel.subscriberCount - 1);
    channel.updatedAt = new Date();
    this.events.push({ channelId, delta: -1, occurredAt: new Date() });
    return ok({ subscriberCount: channel.subscriberCount, changed: true });
  }

  async isSubscribed(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.subscriptions.has(this.key(subscriberChannelId, channelId)));
  }

  async getChannelSubscriptionChannelIds(
    subscriberChannelId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    return ok(
      [...this.subscriptions.values()]
        .filter((sub) => sub.subscriberChannelId === subscriberChannelId)
        .map((sub) => sub.channelId)
    );
  }

  async getUserSubscriptionChannelIds(
    subscriberId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    return ok(this.userSubscriptions(subscriberId).map((s) => s.channelId));
  }

  async setNotificationLevel(
    subscriberChannelId: string,
    channelId: string,
    level: NotificationLevel
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const subscription = this.subscriptions.get(this.key(subscriberChannelId, channelId));
    if (!subscription) return ok(false);

    subscription.notificationLevel = level;
    return ok(true);
  }

  async listSubscribers(
    channelId: string,
    options: ListSubscribersOptions
  ): Promise<Result<ChannelSubscriber[], DatabaseUnavailable>> {
    const { after } = options;
    const loudest = new Map<string, NotificationLevel>();
    for (const sub of this.subscriptions.values()) {
      if (sub.channelId !== channelId || (after && sub.subscriberId <= after)) continue;
      const held = loudest.get(sub.subscriberId);
      const louder =
        held === undefined ||
        NOTIFICATION_LEVELS.indexOf(sub.notificationLevel) < NOTIFICATION_LEVELS.indexOf(held);
      if (louder) loudest.set(sub.subscriberId, sub.notificationLevel);
    }
    return ok(
      [...loudest]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, options.limit)
        .map(([subscriberId, notificationLevel]) => ({ subscriberId, notificationLevel }))
    );
  }

  subscriptionEvents(): { channelId: string; delta: 1 | -1; occurredAt: Date }[] {
    return this.events.map((event) => ({ ...event }));
  }

  async getSubscriberCount(channelId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok((await this.findChannel(channelId))?.subscriberCount ?? 0);
  }

  async countFromVideo(videoId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok(
      Array.from(this.subscriptions.values()).filter((sub) => sub.sourceVideoId === videoId).length
    );
  }

  async netSubscribers(
    channelId: string,
    range: ViewDateRange
  ): Promise<Result<number, DatabaseUnavailable>> {
    let net = 0;
    for (const event of this.events) {
      const day = viewDateOf(event.occurredAt);
      if (day < range.from || day > range.to) continue;
      if (event.channelId === channelId) net += event.delta;
    }
    return ok(net);
  }

  async listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<Result<SubscribedChannelItem[], DatabaseUnavailable>> {
    const cursor = options.cursor && {
      sort: options.cursor.createdAt,
      tie: options.cursor.channelId,
    };

    const page = this.userSubscriptions(subscriberId)
      .map((sub) => ({ sub, sort: sub.createdAt, tie: sub.channelId }))
      .sort(byKeysetDesc)
      .filter((row) => isKeysetBefore(row, cursor))
      .slice(0, options.limit + 1);

    const items: SubscribedChannelItem[] = [];
    for (const { sub } of page) {
      const channel = unwrapOr(await this.channelsRepo.findById(sub.channelId), null);
      if (!channel) continue;
      const { createdAt: _createdAt, updatedAt: _updatedAt, ...profile } = channel;
      items.push({
        ...profile,
        subscribedAt: sub.createdAt,
        notificationLevel: sub.notificationLevel,
      });
    }
    return ok(items);
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<Result<{ items: VideoRecord[]; total: number }, DatabaseUnavailable>> {
    const followed = new Set(this.userSubscriptions(subscriberId).map((sub) => sub.channelId));

    const matching = this.videosRepo
      .getAllVideos()
      .filter(
        (v) =>
          followed.has(v.channelId) &&
          v.visibility === 'public' &&
          v.status === 'READY' &&
          !v.deletedAt
      )
      .map((video) => ({ video, sort: video.createdAt, tie: video.id }))
      .sort(byKeysetDesc);

    const cursor = options.cursor && {
      sort: options.cursor.createdAt,
      tie: options.cursor.id,
    };

    const items = matching
      .filter((row) => isKeysetBefore(row, cursor))
      .slice(0, options.limit + 1)
      .map((row) => row.video);

    return ok({ items, total: matching.length });
  }

  /** The account's first subscription to each channel, however many of its channels subscribe. */
  private userSubscriptions(subscriberId: string): ChannelSubscription[] {
    const first = new Map<string, ChannelSubscription>();
    for (const sub of this.subscriptions.values()) {
      if (sub.subscriberId !== subscriberId) continue;
      const held = first.get(sub.channelId);
      if (!held || sub.createdAt < held.createdAt) first.set(sub.channelId, sub);
    }
    return [...first.values()];
  }

  clear(): void {
    this.subscriptions.clear();
    this.events.length = 0;
  }
}

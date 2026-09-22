import type {
  ChannelSubscription,
  SubscribedChannelItem,
  SubscriptionChangeResult,
} from '@vp/domain';
import type {
  ListSubscriptionsOptions,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok, unwrapOr } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

export interface InMemorySubscriptionRepositoryOptions {
  channelsRepo: InMemoryChannelRepository;
  videosRepo: InMemoryVideoRepository;
}

export class InMemorySubscriptionRepository implements SubscriptionRepositoryPort {
  private readonly subscriptions = new Map<string, ChannelSubscription>();
  private readonly channelsRepo: InMemoryChannelRepository;
  private readonly videosRepo: InMemoryVideoRepository;

  constructor(options: InMemorySubscriptionRepositoryOptions) {
    this.channelsRepo = options.channelsRepo;
    this.videosRepo = options.videosRepo;
  }

  private key(subscriberId: string, channelId: string): string {
    return `${subscriberId}:${channelId}`;
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
   * One await, then nothing. The claim and the counter move together with no yield between them,
   * the way the Postgres adapter's transaction moves them, so ten concurrent subscribes cannot
   * observe a half-step - which is exactly what they did when the counter update sat behind its
   * own `await` and every loser reported zero.
   */
  async subscribe(
    subscriberId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>> {
    const channel = await this.findChannel(channelId);
    if (!channel) return ok({ subscriberCount: 0, changed: false });

    const key = this.key(subscriberId, channelId);
    if (this.subscriptions.has(key)) {
      return ok({ subscriberCount: channel.subscriberCount, changed: false });
    }

    this.subscriptions.set(key, { id: uuidv7(), subscriberId, channelId, createdAt: new Date() });
    channel.subscriberCount += 1;
    channel.updatedAt = new Date();
    return ok({ subscriberCount: channel.subscriberCount, changed: true });
  }

  async unsubscribe(
    subscriberId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>> {
    const channel = await this.findChannel(channelId);
    if (!channel) return ok({ subscriberCount: 0, changed: false });

    const key = this.key(subscriberId, channelId);
    if (!this.subscriptions.delete(key)) {
      return ok({ subscriberCount: channel.subscriberCount, changed: false });
    }

    channel.subscriberCount = Math.max(0, channel.subscriberCount - 1);
    channel.updatedAt = new Date();
    return ok({ subscriberCount: channel.subscriberCount, changed: true });
  }

  async isSubscribed(
    subscriberId: string,
    channelId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.subscriptions.has(this.key(subscriberId, channelId)));
  }

  async getUserSubscriptionChannelIds(
    subscriberId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    return ok(this.userSubscriptions(subscriberId).map((s) => s.channelId));
  }

  async getSubscriberCount(channelId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok((await this.findChannel(channelId))?.subscriberCount ?? 0);
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
      items.push({ ...profile, subscribedAt: sub.createdAt });
    }
    return ok(items);
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<Result<{ items: VideoRecord[]; total: number }, DatabaseUnavailable>> {
    const ownerIds = new Set<string>();
    for (const channelId of unwrapOr(await this.getUserSubscriptionChannelIds(subscriberId), [])) {
      const channel = unwrapOr(await this.channelsRepo.findById(channelId), null);
      if (channel) ownerIds.add(channel.userId);
    }

    const matching = this.videosRepo
      .getAllVideos()
      .filter(
        (v) =>
          ownerIds.has(v.ownerId) &&
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

  private userSubscriptions(subscriberId: string): ChannelSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.subscriberId === subscriberId
    );
  }

  clear(): void {
    this.subscriptions.clear();
  }
}

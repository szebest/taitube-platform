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
import { ErrorCodes, PermanentError } from '@vp/errors';
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

  private async requireChannel(channelId: string) {
    const channel = await this.channelsRepo.findById(channelId);
    if (!channel) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');
    }
    return channel;
  }

  async subscribe(subscriberId: string, channelId: string): Promise<SubscriptionChangeResult> {
    const channel = await this.requireChannel(channelId);
    if (channel.userId === subscriberId) {
      throw new PermanentError(
        ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
        'Cannot subscribe to your own channel'
      );
    }

    const key = this.key(subscriberId, channelId);
    if (this.subscriptions.has(key)) {
      return { subscriberCount: channel.subscriberCount, changed: false };
    }

    this.subscriptions.set(key, {
      id: uuidv7(),
      subscriberId,
      channelId,
      createdAt: new Date(),
    });
    const subscriberCount = await this.channelsRepo.adjustSubscriberCount(channelId, 1);
    return { subscriberCount, changed: true };
  }

  async unsubscribe(subscriberId: string, channelId: string): Promise<SubscriptionChangeResult> {
    const channel = await this.requireChannel(channelId);

    const key = this.key(subscriberId, channelId);
    if (!this.subscriptions.delete(key)) {
      return { subscriberCount: channel.subscriberCount, changed: false };
    }

    const subscriberCount = await this.channelsRepo.adjustSubscriberCount(channelId, -1);
    return { subscriberCount, changed: true };
  }

  async isSubscribed(subscriberId: string, channelId: string): Promise<boolean> {
    return this.subscriptions.has(this.key(subscriberId, channelId));
  }

  async getUserSubscriptionChannelIds(subscriberId: string): Promise<string[]> {
    return this.userSubscriptions(subscriberId).map((s) => s.channelId);
  }

  async getSubscriberCount(channelId: string): Promise<number> {
    const channel = await this.channelsRepo.findById(channelId);
    return channel?.subscriberCount ?? 0;
  }

  async listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<SubscribedChannelItem[]> {
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
      const channel = await this.channelsRepo.findById(sub.channelId);
      if (!channel) continue;
      const { createdAt: _createdAt, updatedAt: _updatedAt, ...profile } = channel;
      items.push({ ...profile, subscribedAt: sub.createdAt });
    }
    return items;
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<{ items: VideoRecord[]; total: number }> {
    const ownerIds = new Set<string>();
    for (const channelId of await this.getUserSubscriptionChannelIds(subscriberId)) {
      const channel = await this.channelsRepo.findById(channelId);
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

    return { items, total: matching.length };
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

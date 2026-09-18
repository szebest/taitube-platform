import type {
  ChannelRepositoryPort,
  ChannelSubscription,
  ListSubscriptionsOptions,
  SubscribedChannelItem,
  SubscribeResult,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  UnsubscribeResult,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { uuidv7 } from 'uuidv7';

const toCursor = (d: unknown) => Buffer.from(JSON.stringify(d)).toString('base64url');

export interface InMemorySubscriptionRepositoryOptions {
  channelsRepo?: ChannelRepositoryPort;
  videosRepo?: VideoRepository;
}

export class InMemorySubscriptionRepository implements SubscriptionRepositoryPort {
  private readonly subscriptions = new Map<string, ChannelSubscription>();
  private channelsRepo?: ChannelRepositoryPort;
  private videosRepo?: VideoRepository;

  constructor(options: InMemorySubscriptionRepositoryOptions = {}) {
    this.channelsRepo = options.channelsRepo;
    this.videosRepo = options.videosRepo;
  }

  setChannelsRepo(repo: ChannelRepositoryPort): void {
    this.channelsRepo = repo;
  }

  setVideosRepo(repo: VideoRepository): void {
    this.videosRepo = repo;
  }

  private key(subscriberId: string, channelId: string): string {
    return `${subscriberId}:${channelId}`;
  }

  async subscribe(subscriberId: string, channelId: string): Promise<SubscribeResult> {
    const channel = this.channelsRepo ? await this.channelsRepo.findById(channelId) : null;
    if (!channel && this.channelsRepo) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');
    }
    if (channel && channel.userId === subscriberId) {
      throw new PermanentError(
        ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
        'Cannot subscribe to your own channel'
      );
    }

    const k = this.key(subscriberId, channelId);
    const existing = this.subscriptions.get(k);
    let subscriberCount = channel?.subscriberCount ?? 0;

    if (!existing) {
      const sub: ChannelSubscription = {
        id: uuidv7(),
        subscriberId,
        channelId,
        createdAt: new Date(),
      };
      this.subscriptions.set(k, sub);
      subscriberCount += 1;
      if (channel && this.channelsRepo) {
        channel.subscriberCount = subscriberCount;
      }
      return { subscribed: true, subscriberCount, isNew: true };
    }

    return { subscribed: true, subscriberCount, isNew: false };
  }

  async unsubscribe(subscriberId: string, channelId: string): Promise<UnsubscribeResult> {
    const channel = this.channelsRepo ? await this.channelsRepo.findById(channelId) : null;
    if (!channel && this.channelsRepo) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');
    }

    const k = this.key(subscriberId, channelId);
    const existing = this.subscriptions.get(k);
    let subscriberCount = channel?.subscriberCount ?? 0;

    if (existing) {
      this.subscriptions.delete(k);
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (channel && this.channelsRepo) {
        channel.subscriberCount = subscriberCount;
      }
      return { subscribed: false, subscriberCount, wasSubscribed: true };
    }

    return { subscribed: false, subscriberCount, wasSubscribed: false };
  }

  async isSubscribed(subscriberId: string, channelId: string): Promise<boolean> {
    return this.subscriptions.has(this.key(subscriberId, channelId));
  }

  async getUserSubscriptionChannelIds(subscriberId: string): Promise<string[]> {
    const result: string[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.subscriberId === subscriberId) {
        result.push(sub.channelId);
      }
    }
    return result;
  }

  async getSubscriberCount(channelId: string): Promise<number> {
    if (this.channelsRepo) {
      const ch = await this.channelsRepo.findById(channelId);
      if (ch) return ch.subscriberCount;
    }
    let count = 0;
    for (const sub of this.subscriptions.values()) {
      if (sub.channelId === channelId) count++;
    }
    return count;
  }

  async listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<{ items: SubscribedChannelItem[]; nextCursor: string | null }> {
    const userSubs: ChannelSubscription[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.subscriberId === subscriberId) {
        userSubs.push(sub);
      }
    }

    userSubs.sort((a, b) => {
      const diff = b.createdAt.getTime() - a.createdAt.getTime();
      return diff !== 0 ? diff : b.channelId.localeCompare(a.channelId);
    });

    const cursor = options.cursor;
    const filtered = cursor
      ? userSubs.filter((s) => {
          const cursorDate =
            cursor.createdAt instanceof Date
              ? cursor.createdAt
              : new Date(cursor.createdAt);
          const sDate = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
          const timeDiff = sDate.getTime() - cursorDate.getTime();
          if (timeDiff < 0) return true;
          if (timeDiff === 0) return s.channelId < cursor.channelId;
          return false;
        })
      : userSubs;

    const hasMore = filtered.length > options.limit;
    const page = hasMore ? filtered.slice(0, options.limit) : filtered;

    const items: SubscribedChannelItem[] = [];
    for (const sub of page) {
      const ch = this.channelsRepo ? await this.channelsRepo.findById(sub.channelId) : null;
      if (ch) {
        items.push({
          id: ch.id,
          userId: ch.userId,
          handle: ch.handle,
          displayName: ch.displayName,
          avatarUrl: ch.avatarUrl,
          bannerUrl: ch.bannerUrl,
          bio: ch.bio,
          subscriberCount: ch.subscriberCount,
          subscribedAt: sub.createdAt,
        });
      }
    }

    const lastSub = items[items.length - 1];
    const nextCursor =
      hasMore && lastSub
        ? toCursor({
            createdAt: lastSub.subscribedAt.toISOString(),
            channelId: lastSub.id,
          })
        : null;

    return { items, nextCursor };
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<{ items: VideoRecord[]; nextCursor: string | null; total: number }> {
    const channelIds = await this.getUserSubscriptionChannelIds(subscriberId);
    const creatorUserIds = new Set<string>();

    if (this.channelsRepo) {
      for (const chId of channelIds) {
        const ch = await this.channelsRepo.findById(chId);
        if (ch) creatorUserIds.add(ch.userId);
      }
    }

    const allMatching: VideoRecord[] = [];
    if (this.videosRepo) {
      const allVideos =
        typeof (this.videosRepo as unknown as { getAllVideos?: () => VideoRecord[] }).getAllVideos === 'function'
          ? (this.videosRepo as unknown as { getAllVideos: () => VideoRecord[] }).getAllVideos()
          : 'videosMap' in (this.videosRepo as unknown as Record<string, unknown>)
            ? Array.from((this.videosRepo as unknown as { videosMap: Map<string, VideoRecord> }).videosMap.values())
            : [];
      for (const v of allVideos) {
        if (
          creatorUserIds.has(v.ownerId) &&
          v.visibility === 'public' &&
          v.status === 'READY' &&
          !v.deletedAt
        ) {
          allMatching.push(v);
        }
      }
    }

    allMatching.sort((a, b) => {
      const diff = b.createdAt.getTime() - a.createdAt.getTime();
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    });

    const total = allMatching.length;

    const cursor = options.cursor;
    const filtered = cursor
      ? allMatching.filter((v) => {
          const cursorDate =
            cursor.createdAt instanceof Date
              ? cursor.createdAt
              : new Date(cursor.createdAt);
          const vDate = v.createdAt instanceof Date ? v.createdAt : new Date(v.createdAt);
          const timeDiff = vDate.getTime() - cursorDate.getTime();
          if (timeDiff < 0) return true;
          if (timeDiff === 0) return v.id < cursor.id;
          return false;
        })
      : allMatching;

    const hasMore = filtered.length > options.limit;
    const items = hasMore ? filtered.slice(0, options.limit) : filtered;

    const lastVideo = items[items.length - 1];
    const nextCursor =
      hasMore && lastVideo
        ? toCursor({
            createdAt: lastVideo.createdAt.toISOString(),
            id: lastVideo.id,
          })
        : null;

    return { items, nextCursor, total };
  }

  clear(): void {
    this.subscriptions.clear();
  }
}

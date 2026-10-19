import type { ChannelRepositoryPort } from '@vp/core/repositories';
import {
  type Channel,
  type ChannelStats,
  type CreateChannelInput,
  type UpdateChannelInput,
  isPublicFeedEligible,
} from '@vp/domain';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type HandleTaken,
  PermanentError,
  handleTaken,
} from '@vp/errors';
import { type Result, err, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

type StoredChannel = Omit<Channel, keyof ChannelStats>;

export class InMemoryChannelRepository implements ChannelRepositoryPort {
  private readonly channels = new Map<string, StoredChannel>();

  constructor(private readonly videosRepo: Pick<InMemoryVideoRepository, 'getAllVideos'>) {
    this.seedDevChannels();
  }

  /**
   * Postgres keeps these as counters a trigger moves with every video write; the double derives the
   * same numbers from the videos it is wired to, over the same public-feed predicate.
   */
  private withStats(channel: StoredChannel): Channel {
    const counted = this.videosRepo
      .getAllVideos()
      .filter((video) => isPublicFeedEligible(video, { ownerId: channel.userId }));
    return {
      ...channel,
      links: channel.links.map((link) => ({ ...link })),
      videoCount: counted.length,
      totalViews: counted.reduce((sum, video) => sum + (video.viewsCount ?? 0), 0),
    };
  }

  seedDevChannels(): void {
    const now = new Date();
    this.channels.set('00000000-0000-7000-8000-000000000101', {
      id: '00000000-0000-7000-8000-000000000101',
      userId: '00000000-0000-7000-8000-000000000001',
      handle: 'dev',
      displayName: 'Dev Channel',
      avatarUrl: null,
      bannerUrl: null,
      bio: 'Development testing channel',
      links: [],
      subscriberCount: 42,
      createdAt: now,
      updatedAt: now,
    });
    this.channels.set('00000000-0000-7000-8000-000000000102', {
      id: '00000000-0000-7000-8000-000000000102',
      userId: '00000000-0000-7000-8000-000000000002',
      handle: 'user',
      displayName: 'Standard User',
      avatarUrl: null,
      bannerUrl: null,
      bio: null,
      links: [],
      subscriberCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  clear(): void {
    this.channels.clear();
    this.seedDevChannels();
  }

  getAllChannels(): Channel[] {
    return Array.from(this.channels.values(), (channel) => this.withStats(channel));
  }

  async findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return ok(this.present(this.channels.get(id)));
  }

  async findByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return ok(this.present(this.find((channel) => channel.userId === userId)));
  }

  async findByUserIds(userIds: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>> {
    const wanted = new Set(userIds);
    return ok(
      Array.from(this.channels.values())
        .filter((channel) => wanted.has(channel.userId))
        .map((channel) => this.withStats(channel))
    );
  }

  async findByHandle(handle: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    const normalized = handle.toLowerCase();
    return ok(this.present(this.find((channel) => channel.handle.toLowerCase() === normalized)));
  }

  private find(matches: (channel: StoredChannel) => boolean): StoredChannel | null {
    for (const channel of this.channels.values()) {
      if (matches(channel)) return channel;
    }
    return null;
  }

  private present(channel: StoredChannel | null | undefined): Channel | null {
    return channel ? this.withStats(channel) : null;
  }

  async create(
    input: CreateChannelInput
  ): Promise<Result<Channel, DatabaseUnavailable | HandleTaken>> {
    const normalized = input.handle.toLowerCase();
    const colliding = this.find(
      (channel) => channel.handle.toLowerCase() === normalized || channel.userId === input.userId
    );
    if (colliding) return err(handleTaken(normalized));

    const now = new Date();
    const channel: StoredChannel = {
      id: input.id ?? uuidv7(),
      userId: input.userId,
      handle: normalized,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      bio: input.bio ?? null,
      links: [],
      subscriberCount: input.subscriberCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.channels.set(channel.id, channel);
    return ok(this.withStats(channel));
  }

  /** Read without a yield, so a caller that just lost a race reports what the winner left. */
  subscriberCountOf(id: string): number {
    return this.channels.get(id)?.subscriberCount ?? 0;
  }

  /**
   * Moves the subscriber count, which `update` deliberately does not expose
   * because it is owned by the subscription repository, not by the channel owner.
   */
  adjustSubscriberCount(id: string, delta: number): number {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, `Channel ${id} not found`);
    }
    channel.subscriberCount = Math.max(0, channel.subscriberCount + delta);
    channel.updatedAt = new Date();
    return channel.subscriberCount;
  }

  async update(
    id: string,
    input: UpdateChannelInput
  ): Promise<Result<Channel | null, DatabaseUnavailable | HandleTaken>> {
    const channel = this.channels.get(id);
    if (!channel) return ok(null);

    if (input.handle) {
      const normalized = input.handle.toLowerCase();
      const heldByAnother = this.find(
        (other) => other.id !== id && other.handle.toLowerCase() === normalized
      );
      if (heldByAnother) return err(handleTaken(normalized));
      channel.handle = normalized;
    }

    if (input.displayName !== undefined) channel.displayName = input.displayName;
    if (input.avatarUrl !== undefined) channel.avatarUrl = input.avatarUrl;
    if (input.bannerUrl !== undefined) channel.bannerUrl = input.bannerUrl;
    if (input.bio !== undefined) channel.bio = input.bio;
    if (input.links !== undefined) channel.links = input.links;
    channel.updatedAt = new Date();

    return ok(this.withStats(channel));
  }
}

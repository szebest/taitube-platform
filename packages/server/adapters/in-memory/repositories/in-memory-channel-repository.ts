import type { ChannelRepositoryPort } from '@vp/core/repositories';
import {
  type BannerCrops,
  type Channel,
  type ChannelImageKind,
  type ChannelStats,
  type CropRect,
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
import type { InMemoryChannelHandleHistoryRepository } from './in-memory-channel-handle-history-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

export class InMemoryChannelRepository implements ChannelRepositoryPort {
  private readonly channels = new Map<string, Channel>();

  constructor(
    private readonly videosRepo: Pick<InMemoryVideoRepository, 'getAllVideos'>,
    private readonly history: Pick<InMemoryChannelHandleHistoryRepository, 'retire' | 'release'>
  ) {
    this.seedDevChannels();
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
      brandColor: null,
      bio: 'Development testing channel',
      links: [],
      avatarVersion: 0,
      bannerVersion: 0,
      bannerCrops: null,
      country: null,
      contactEmail: null,
      bannerLink: null,
      handleChangedAt: null,
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
      brandColor: null,
      bio: null,
      links: [],
      avatarVersion: 0,
      bannerVersion: 0,
      bannerCrops: null,
      country: null,
      contactEmail: null,
      bannerLink: null,
      handleChangedAt: null,
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
    return Array.from(this.channels.values());
  }

  async findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return ok(this.channels.get(id) ?? null);
  }

  async findByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return ok(this.find((channel) => channel.userId === userId));
  }

  async findByUserIds(userIds: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>> {
    const wanted = new Set(userIds);
    return ok(this.getAllChannels().filter((channel) => wanted.has(channel.userId)));
  }

  async findByHandle(handle: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    const normalized = handle.toLowerCase();
    return ok(this.find((channel) => channel.handle.toLowerCase() === normalized));
  }

  private find(matches: (channel: Channel) => boolean): Channel | null {
    for (const channel of this.channels.values()) {
      if (matches(channel)) return channel;
    }
    return null;
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
    const channel: Channel = {
      id: input.id ?? uuidv7(),
      userId: input.userId,
      handle: normalized,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      brandColor: input.brandColor ?? null,
      bio: input.bio ?? null,
      links: [],
      avatarVersion: 0,
      bannerVersion: 0,
      bannerCrops: null,
      country: null,
      contactEmail: null,
      bannerLink: null,
      handleChangedAt: null,
      subscriberCount: input.subscriberCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.channels.set(channel.id, channel);
    return ok(channel);
  }

  async statsOf(userId: string): Promise<Result<ChannelStats, DatabaseUnavailable>> {
    const counted = this.videosRepo
      .getAllVideos()
      .filter((video) => isPublicFeedEligible(video, { ownerId: userId }));
    return ok({
      videoCount: counted.length,
      totalViews: counted.reduce((sum, video) => sum + (video.viewsCount ?? 0), 0),
    });
  }

  /**
   * Moves the subscriber count, which `update` deliberately does not expose
   * because it is owned by the subscription repository, not by the channel owner.
   */
  async adjustSubscriberCount(id: string, delta: number): Promise<number> {
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
      if (normalized !== channel.handle) this.changeHandle(channel, normalized, input);
    }

    if (input.displayName !== undefined) channel.displayName = input.displayName;
    if (input.avatarUrl !== undefined) channel.avatarUrl = input.avatarUrl;
    if (input.bannerUrl !== undefined) channel.bannerUrl = input.bannerUrl;
    if (input.brandColor !== undefined) channel.brandColor = input.brandColor;
    if (input.bio !== undefined) channel.bio = input.bio;
    if (input.links !== undefined) channel.links = input.links;
    if (input.country !== undefined) channel.country = input.country;
    if (input.contactEmail !== undefined) channel.contactEmail = input.contactEmail;
    if (input.bannerLink !== undefined) channel.bannerLink = input.bannerLink;
    channel.updatedAt = new Date();

    return ok(channel);
  }

  private changeHandle(channel: Channel, handle: string, input: UpdateChannelInput): void {
    const at = input.handleChangedAt ?? new Date();
    this.history.release(handle);
    this.history.retire({ handle: channel.handle, channelId: channel.id, retiredAt: at });
    channel.handle = handle;
    channel.handleChangedAt = at;
  }

  /**
   * Moves an image's version forward, which `update` deliberately does not expose because the
   * image repository owns it; answers whether the version was newer than the one held.
   */
  advanceImageVersion(
    id: string,
    kind: ChannelImageKind,
    version: number,
    crops: BannerCrops | CropRect,
    defaultUrl: string
  ): boolean {
    const channel = this.channels.get(id);
    const held = kind === 'avatar' ? channel?.avatarVersion : channel?.bannerVersion;
    if (!channel || held === undefined || held >= version) return false;

    if (kind === 'avatar') {
      channel.avatarVersion = version;
      channel.avatarUrl = defaultUrl;
    } else {
      channel.bannerVersion = version;
      channel.bannerUrl = defaultUrl;
      channel.bannerCrops = crops as BannerCrops;
    }
    channel.updatedAt = new Date();
    return true;
  }
}

import { PermanentError, type DatabaseUnavailable } from '@kit/errors';
import { type Result, err, isErr, ok } from '@kit/result';
import type { ChannelRepositoryPort } from '@vp/core/repositories';
import {
  type Channel,
  type ChannelImageKind,
  type ChannelStats,
  type CreateChannelInput,
  type ImageCrops,
  type NewChannelAuditEntry,
  type UpdateChannelInput,
  isPublicFeedEligible,
} from '@vp/domain';
import {
  type ChannelLimitReached,
  ErrorCodes,
  type HandleTaken,
  channelLimitReached,
  handleTaken,
} from '@vp/errors';
import { uuidv7 } from 'uuidv7';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelHandleHistoryRepository } from './in-memory-channel-handle-history-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

function newChannel(input: CreateChannelInput, isPrimary: boolean): Channel {
  const now = new Date();
  return {
    id: input.id ?? uuidv7(),
    userId: input.userId,
    isPrimary,
    handle: input.handle.toLowerCase(),
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
}

export class InMemoryChannelRepository implements ChannelRepositoryPort {
  private readonly channels = new Map<string, Channel>();

  constructor(
    private readonly videosRepo: Pick<InMemoryVideoRepository, 'getAllVideos'>,
    private readonly history: Pick<InMemoryChannelHandleHistoryRepository, 'retire' | 'release'>,
    private readonly audit: Pick<InMemoryChannelAuditRepository, 'append'>
  ) {
    this.seedDevChannels();
  }

  seedDevChannels(): void {
    for (const input of [
      {
        id: '00000000-0000-7000-8000-000000000101',
        userId: '00000000-0000-7000-8000-000000000001',
        handle: 'dev',
        displayName: 'Dev Channel',
        bio: 'Development testing channel',
        subscriberCount: 42,
      },
      {
        id: '00000000-0000-7000-8000-000000000102',
        userId: '00000000-0000-7000-8000-000000000002',
        handle: 'user',
        displayName: 'Standard User',
      },
    ]) {
      this.channels.set(input.id, newChannel(input, true));
    }
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

  async listByUserId(userId: string): Promise<Result<Channel[], DatabaseUnavailable>> {
    return ok(this.ownedBy(userId));
  }

  async findPrimaryByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return ok(this.primaryOf(userId));
  }

  async findPrimaryByUserIds(
    userIds: readonly string[]
  ): Promise<Result<Channel[], DatabaseUnavailable>> {
    const wanted = new Set(userIds);
    return ok(
      this.getAllChannels().filter((channel) => channel.isPrimary && wanted.has(channel.userId))
    );
  }

  private ownedBy(userId: string): Channel[] {
    return this.getAllChannels()
      .filter((channel) => channel.userId === userId)
      .sort(
        (a, b) =>
          Number(b.isPrimary) - Number(a.isPrimary) ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id)
      );
  }

  private primaryOf(userId: string): Channel | null {
    return this.find((channel) => channel.isPrimary && channel.userId === userId);
  }

  async findByIds(ids: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>> {
    const wanted = new Set(ids);
    return ok(this.getAllChannels().filter((channel) => wanted.has(channel.id)));
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
    if (this.primaryOf(input.userId)) return err(handleTaken(input.handle.toLowerCase()));
    return this.insert(input, true);
  }

  async createOwned(
    input: CreateChannelInput,
    limit: number,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel, DatabaseUnavailable | HandleTaken | ChannelLimitReached>> {
    const owned = this.ownedBy(input.userId);
    if (owned.length >= limit) return err(channelLimitReached(limit));
    const inserted = this.insert(input, !owned.some((channel) => channel.isPrimary));
    return isErr(inserted) ? inserted : this.audited(inserted.value, audit);
  }

  async promote(
    userId: string,
    channelId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel | null, DatabaseUnavailable>> {
    const target = this.channels.get(channelId);
    if (!target || target.userId !== userId) return ok(null);

    const now = new Date();
    for (const channel of this.ownedBy(userId)) {
      const isPrimary = channel.id === channelId;
      if (channel.isPrimary !== isPrimary) Object.assign(channel, { isPrimary, updatedAt: now });
    }
    return this.audited(target, audit);
  }

  private async audited<T>(
    written: T,
    audit: NewChannelAuditEntry | undefined
  ): Promise<Result<T, DatabaseUnavailable>> {
    if (audit) {
      const appended = await this.audit.append(audit);
      if (isErr(appended)) return appended;
    }
    return ok(written);
  }

  private insert(input: CreateChannelInput, isPrimary: boolean): Result<Channel, HandleTaken> {
    const normalized = input.handle.toLowerCase();
    if (this.find((channel) => channel.handle.toLowerCase() === normalized)) {
      return err(handleTaken(normalized));
    }

    const channel = newChannel(input, isPrimary);
    this.channels.set(channel.id, channel);
    return ok(channel);
  }

  async statsOf(channelId: string): Promise<Result<ChannelStats, DatabaseUnavailable>> {
    const counted = this.videosRepo
      .getAllVideos()
      .filter((video) => isPublicFeedEligible(video, { channelId }));
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
    input: UpdateChannelInput,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel | null, DatabaseUnavailable | HandleTaken>> {
    const channel = this.channels.get(id);
    if (!channel) return ok(null);

    if (input.handle) {
      const normalized = input.handle.toLowerCase();
      const heldByAnother = this.find(
        (other) => other.id !== id && other.handle.toLowerCase() === normalized
      );
      if (heldByAnother) return err(handleTaken(normalized));
      if (normalized !== channel.handle)
        this.changeHandle(channel, normalized, input.handleChangedAt);
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

    return this.audited(channel, audit);
  }

  private changeHandle(channel: Channel, handle: string, at: Date): void {
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
    kind: Exclude<ChannelImageKind, 'playlist-cover' | 'post-image'>,
    version: number,
    crops: ImageCrops,
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
      if (crops.kind === 'banner') channel.bannerCrops = crops.crops;
    }
    channel.updatedAt = new Date();
    return true;
  }
}

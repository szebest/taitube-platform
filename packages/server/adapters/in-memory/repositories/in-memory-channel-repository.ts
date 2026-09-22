import type { ChannelRepositoryPort } from '@vp/core/repositories';
import type { Channel, CreateChannelInput, UpdateChannelInput } from '@vp/domain';
import {
  type DatabaseUnavailable,
  type HandleTaken,
  ErrorCodes,
  PermanentError,
  handleTaken,
} from '@vp/errors';
import { type Result, err, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export class InMemoryChannelRepository implements ChannelRepositoryPort {
  private readonly channels = new Map<string, Channel>();

  constructor() {
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
      bio: 'Development testing channel',
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
      subscriberCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    this.channels.set('00000000-0000-7000-8000-000000000103', {
      id: '00000000-0000-7000-8000-000000000103',
      userId: '00000000-0000-7000-8000-000000000003',
      handle: 'admin',
      displayName: 'System Admin',
      avatarUrl: null,
      bannerUrl: null,
      bio: 'Administrator channel',
      subscriberCount: 999,
      createdAt: now,
      updatedAt: now,
    });
  }

  clear(): void {
    this.channels.clear();
    this.seedDevChannels();
  }

  async findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return ok(this.channels.get(id) ?? null);
  }

  async findByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return ok(this.find((channel) => channel.userId === userId));
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
      bio: input.bio ?? null,
      subscriberCount: input.subscriberCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.channels.set(channel.id, channel);
    return ok(channel);
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
      channel.handle = normalized;
    }

    if (input.displayName !== undefined) channel.displayName = input.displayName;
    if (input.avatarUrl !== undefined) channel.avatarUrl = input.avatarUrl;
    if (input.bannerUrl !== undefined) channel.bannerUrl = input.bannerUrl;
    if (input.bio !== undefined) channel.bio = input.bio;
    channel.updatedAt = new Date();

    return ok(channel);
  }
}

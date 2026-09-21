import {
  handleCandidates,
  isReservedHandle,
  isValidHandleFormat,
  normalizeHandle,
} from '@vp/core/domain';
import type { ChannelRepository, UserRepository } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';

export interface ChannelServiceDeps {
  users: UserRepository;
  channels: ChannelRepository;
}

export interface ChannelView {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccountView {
  id: string;
  email: string;
  tier: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    tier: string;
    createdAt: string;
  };
  channel: ChannelView;
}

export interface UpdateChannelInput {
  displayName?: string;
  handle?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * ChannelService — Domain service managing user identity profiles and channel lifecycles.
 */
export class ChannelService {
  private readonly users: UserRepository;
  private readonly channels: ChannelRepository;

  constructor(deps: ChannelServiceDeps) {
    this.users = deps.users;
    this.channels = deps.channels;
  }

  /**
   * Retrieves authenticated user details and their associated channel profile.
   */
  async getAccount(userId: string): Promise<UserAccountView> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new PermanentError(ErrorCodes.UNAUTHORIZED, 'User record not found');
    }

    const channel = await this.channels.findByUserId(userId);
    if (!channel) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found for user');
    }

    const channelFormatted: ChannelView = {
      ...channel,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    };

    const userFormatted = {
      id: user.id,
      email: user.email,
      tier: user.tier,
      createdAt: user.createdAt.toISOString(),
    };

    return {
      ...userFormatted,
      user: userFormatted,
      channel: channelFormatted,
    };
  }

  /**
   * Updates an authenticated user's channel profile with validation and normalization.
   */
  async updateChannel(userId: string, input: UpdateChannelInput): Promise<ChannelView> {
    const channel = await this.channels.findByUserId(userId);
    if (!channel) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found for user');
    }

    let newHandle: string | undefined;
    if (input.handle !== undefined) {
      if (!isValidHandleFormat(input.handle)) {
        throw new PermanentError(
          ErrorCodes.INVALID_HANDLE_FORMAT,
          'Invalid handle format: must be 3-30 characters matching ^[a-zA-Z0-9_.-]+$'
        );
      }
      if (isReservedHandle(input.handle)) {
        throw new PermanentError(
          ErrorCodes.HANDLE_ALREADY_TAKEN,
          `Handle "${input.handle}" is reserved`
        );
      }
      newHandle = normalizeHandle(input.handle);
    }

    const updated = await this.channels.update(channel.id, {
      handle: newHandle,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      bannerUrl: input.bannerUrl,
      bio: input.bio,
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves public channel details by UUID or handle.
   */
  async getPublicChannel(idOrHandle: string): Promise<ChannelView> {
    const rawHandle = normalizeHandle(idOrHandle);

    let channel = null;
    if (UUID_REGEX.test(idOrHandle)) {
      channel = await this.channels.findById(idOrHandle);
    }

    if (!channel) {
      channel = await this.channels.findByHandle(rawHandle);
    }

    if (!channel) {
      throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, `Channel "${idOrHandle}" not found`);
    }

    return {
      ...channel,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    };
  }

  /**
   * Creates the user and channel rows a verified identity implies, on its first
   * authenticated request. Both writes tolerate losing a race with a concurrent
   * request for the same identity.
   */
  async ensureProvisioned(userId: string, email?: string): Promise<void> {
    const userEmail = email || `${userId}@taitube.local`;

    if (!(await this.users.findById(userId))) {
      try {
        await this.users.upsert({ id: userId, email: userEmail, tier: 'free' });
      } catch {
        // A concurrent request for the same identity already inserted it.
      }
    }

    if (await this.channels.findByUserId(userId)) {
      return;
    }

    try {
      await this.channels.create({
        userId,
        handle: await this.claimHandle(userEmail, userId),
        displayName: email ? email.split('@')[0] || 'User' : 'User',
      });
    } catch {
      // A concurrent request for the same identity already created the channel.
    }
  }

  private async claimHandle(email: string, userId: string): Promise<string> {
    for (const candidate of handleCandidates(email, userId)) {
      if (!(await this.channels.findByHandle(candidate))) {
        return candidate;
      }
    }

    throw new PermanentError(
      ErrorCodes.HANDLE_ALREADY_TAKEN,
      `Could not derive a free handle for user ${userId}`
    );
  }
}

import type {
  ChannelRepositoryPort,
  PlaylistRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import {
  type ChannelNotFound,
  type ClaimHandleFailure,
  channelNotFound,
  decideHandleClaim,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes, type HandleTaken } from '@vp/errors';
import { type Result, err, isErr, ok } from '@vp/result';
import { handleCandidates } from '@vp/validation';
import { uuidv7 } from 'uuidv7';

export interface ChannelServiceDeps {
  users: UserRepository;
  channels: ChannelRepositoryPort;
  playlists: PlaylistRepositoryPort;
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

type AccountNotFound = { readonly code: 'UNAUTHORIZED'; readonly message: string };

export type GetAccountFailure = AccountNotFound | ChannelNotFound | DatabaseUnavailable;
export type UpdateChannelFailure = ChannelNotFound | ClaimHandleFailure | DatabaseUnavailable;
export type GetPublicChannelFailure = ChannelNotFound | DatabaseUnavailable;
export type ProvisionFailure = DatabaseUnavailable | HandleTaken;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function toChannelView(channel: Channel): ChannelView {
  return {
    ...channel,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

/** User identity profiles and channel lifecycles. Returns its failures; throws none. */
export class ChannelService {
  private readonly users: UserRepository;
  private readonly channels: ChannelRepositoryPort;
  private readonly playlists: PlaylistRepositoryPort;

  constructor(deps: ChannelServiceDeps) {
    this.users = deps.users;
    this.channels = deps.channels;
    this.playlists = deps.playlists;
  }

  async getAccount(userId: string): Promise<Result<UserAccountView, GetAccountFailure>> {
    const user = await this.users.findById(userId);
    if (isErr(user)) return user;
    if (!user.value) {
      return err({ code: ErrorCodes.UNAUTHORIZED, message: 'User record not found' });
    }

    const channel = await this.channels.findByUserId(userId);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(channelNotFound(userId));

    const account = {
      id: user.value.id,
      email: user.value.email,
      tier: user.value.tier,
      createdAt: user.value.createdAt.toISOString(),
    };

    return ok({ ...account, user: account, channel: toChannelView(channel.value) });
  }

  async updateChannel(
    userId: string,
    input: UpdateChannelInput
  ): Promise<Result<ChannelView, UpdateChannelFailure>> {
    const existing = await this.channels.findByUserId(userId);
    if (isErr(existing)) return existing;
    if (!existing.value) return err(channelNotFound(userId));

    let handle: string | undefined;
    if (input.handle !== undefined) {
      const heldBy = await this.channels.findByHandle(input.handle);
      if (isErr(heldBy)) return heldBy;

      const claimed = decideHandleClaim({
        handle: input.handle,
        heldBy: heldBy.value,
        claimantChannelId: existing.value.id,
      });
      if (isErr(claimed)) return claimed;
      handle = claimed.value;
    }

    const updated = await this.channels.update(existing.value.id, {
      handle,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      bannerUrl: input.bannerUrl,
      bio: input.bio,
    });
    if (isErr(updated)) return updated;

    return updated.value ? ok(toChannelView(updated.value)) : err(channelNotFound(userId));
  }

  async getPublicChannel(
    idOrHandle: string
  ): Promise<Result<ChannelView, GetPublicChannelFailure>> {
    if (UUID_REGEX.test(idOrHandle)) {
      const byId = await this.channels.findById(idOrHandle);
      if (isErr(byId)) return byId;
      if (byId.value) return ok(toChannelView(byId.value));
    }

    const byHandle = await this.channels.findByHandle(idOrHandle.replace(/^@/, ''));
    if (isErr(byHandle)) return byHandle;

    return byHandle.value ? ok(toChannelView(byHandle.value)) : err(channelNotFound(idOrHandle));
  }

  /**
   * Creates the user, channel and Watch Later rows a verified identity implies, on its first
   * authenticated request. Every write tolerates losing a race with a concurrent request for the
   * same identity - and only that, so a dead store still surfaces instead of a half-provisioned user.
   */
  async ensureProvisioned(userId: string, email?: string): Promise<Result<void, ProvisionFailure>> {
    const userEmail = email || `${userId}@taitube.local`;

    const existingUser = await this.users.findById(userId);
    if (isErr(existingUser)) return existingUser;

    if (!existingUser.value) {
      const upserted = await this.users.upsert({ id: userId, email: userEmail, tier: 'free' });
      if (isErr(upserted)) return upserted;
    }

    const existingChannel = await this.channels.findByUserId(userId);
    if (isErr(existingChannel)) return existingChannel;
    if (existingChannel.value) return ok();

    // The channel is the "already provisioned" marker, so Watch Later has to exist before it does.
    const watchLater = await this.playlists.provisionWatchLater({ id: uuidv7(), ownerId: userId });
    if (isErr(watchLater)) return watchLater;

    const handle = await this.claimHandle(userEmail, userId);
    if (isErr(handle)) return handle;

    const created = await this.channels.create({
      userId,
      handle: handle.value,
      displayName: email ? email.split('@')[0] || 'User' : 'User',
    });

    // A concurrent request for the same identity got there first; that is a success for us.
    return isErr(created) && created.error.code !== ErrorCodes.HANDLE_ALREADY_TAKEN
      ? created
      : ok();
  }

  private async claimHandle(
    email: string,
    userId: string
  ): Promise<Result<string, ProvisionFailure>> {
    for (const candidate of handleCandidates(email, userId)) {
      const heldBy = await this.channels.findByHandle(candidate);
      if (isErr(heldBy)) return heldBy;
      if (!heldBy.value) return ok(candidate);
    }

    return err({
      code: ErrorCodes.HANDLE_ALREADY_TAKEN,
      message: `Could not derive a free handle for user ${userId}`,
      handle: '',
    });
  }
}

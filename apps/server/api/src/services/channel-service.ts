import type { Account, ChannelPlaylistView, Channel as ChannelResource } from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  PlaylistRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import {
  type Channel,
  type ChannelStats,
  type UpdateChannelInput,
  type VideoFormat,
  toChannelCard,
} from '@vp/domain';
import {
  type ChannelNotFound,
  type ClaimHandleFailure,
  channelNotFound,
  decideHandleClaim,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { type DatabaseUnavailable, ErrorCodes, type HandleTaken } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';
import { type InvalidChannelLinks, handleCandidates, validateChannelLinks } from '@vp/validation';
import { uuidv7 } from 'uuidv7';
import { decodeCreatedAtCursor, createdAtCursorPayload } from './cursor';
import { toChannelPlaylistView } from './library-views';
import type { ListVideosFailure, VideoService, VideoSummaryView } from './video-service';

export interface ChannelServiceDeps {
  users: UserRepository;
  channels: ChannelRepositoryPort;
  playlists: PlaylistRepositoryPort;
  videoService: VideoService;
  paginator: Paginator;
  cdn: CdnBase;
}

export type ChannelView = ChannelResource;

export type UserAccountView = Account;

type AccountNotFound = { readonly code: 'UNAUTHORIZED'; readonly message: string };

export type GetAccountFailure = AccountNotFound | ChannelNotFound | DatabaseUnavailable;
export type UpdateChannelFailure =
  | ChannelNotFound
  | ClaimHandleFailure
  | InvalidChannelLinks
  | DatabaseUnavailable;
export type GetPublicChannelFailure = ChannelNotFound | DatabaseUnavailable;
export type ListChannelVideosFailure = GetPublicChannelFailure | ListVideosFailure;
export type ListChannelPlaylistsFailure =
  | GetPublicChannelFailure
  | InvalidCursor
  | DatabaseUnavailable;
export type ProvisionFailure = DatabaseUnavailable | HandleTaken;

export interface ChannelVideosPage {
  items: VideoSummaryView[];
  nextCursor: string | null;
  total: number;
}

export interface ChannelPlaylistsPage {
  items: ChannelPlaylistView[];
  nextCursor: string | null;
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function toChannelView(channel: Channel, stats: ChannelStats): ChannelView {
  return {
    ...channel,
    ...stats,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

/** User identity profiles and channel lifecycles. Returns its failures; throws none. */
export class ChannelService {
  constructor(private readonly deps: ChannelServiceDeps) {}

  /** The caller's account; its role is the one the verified token carries, which no table stores. */
  async getAccount(caller: UserContext): Promise<Result<UserAccountView, GetAccountFailure>> {
    const user = await this.deps.users.findById(caller.id);
    if (isErr(user)) return user;
    if (!user.value) {
      return err({ code: ErrorCodes.UNAUTHORIZED, message: 'User record not found' });
    }

    const channel = await this.deps.channels.findByUserId(caller.id);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(channelNotFound(caller.id));

    const account = {
      id: user.value.id,
      email: user.value.email,
      tier: user.value.tier,
      createdAt: user.value.createdAt.toISOString(),
    };

    const view = await this.channelView(channel.value);
    if (isErr(view)) return view;

    return ok({ ...account, role: caller.role, user: account, channel: view.value });
  }

  async updateChannel(
    userId: string,
    input: UpdateChannelInput
  ): Promise<Result<ChannelView, UpdateChannelFailure>> {
    const existing = await this.deps.channels.findByUserId(userId);
    if (isErr(existing)) return existing;
    if (!existing.value) return err(channelNotFound(userId));

    let links: UpdateChannelInput['links'];
    if (input.links !== undefined) {
      const checked = validateChannelLinks(input.links);
      if (isErr(checked)) return checked;
      links = checked.value;
    }

    let handle: string | undefined;
    if (input.handle !== undefined) {
      const heldBy = await this.deps.channels.findByHandle(input.handle);
      if (isErr(heldBy)) return heldBy;

      const claimed = decideHandleClaim({
        handle: input.handle,
        heldBy: heldBy.value,
        claimantChannelId: existing.value.id,
      });
      if (isErr(claimed)) return claimed;
      handle = claimed.value;
    }

    const updated = await this.deps.channels.update(existing.value.id, {
      handle,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      bannerUrl: input.bannerUrl,
      bio: input.bio,
      links,
    });
    if (isErr(updated)) return updated;

    return updated.value ? await this.channelView(updated.value) : err(channelNotFound(userId));
  }

  async getPublicChannel(
    idOrHandle: string
  ): Promise<Result<ChannelView, GetPublicChannelFailure>> {
    const channel = await this.findPublicChannel(idOrHandle);
    return isErr(channel) ? channel : await this.channelView(channel.value);
  }

  /** Every video of the channel is its own, so the card comes from the lookup, not another read. */
  async listVideos(
    idOrHandle: string,
    page: { cursor?: string; limit?: number; format?: VideoFormat }
  ): Promise<Result<ChannelVideosPage, ListChannelVideosFailure>> {
    const channel = await this.findPublicChannel(idOrHandle);
    if (isErr(channel)) return channel;

    const cards = await this.deps.videoService.listPublic({
      ...page,
      sort: 'recent',
      ownerId: channel.value.userId,
    });
    const card = toChannelCard(channel.value);
    return map(cards, (found) => ({
      ...found,
      items: found.items.map((item) => ({ ...item, channel: card })),
    }));
  }

  async listPlaylists(
    idOrHandle: string,
    page: { cursor?: string; limit?: number }
  ): Promise<Result<ChannelPlaylistsPage, ListChannelPlaylistsFailure>> {
    const { paginator, cdn } = this.deps;
    const channel = await this.findPublicChannel(idOrHandle);
    if (isErr(channel)) return channel;

    const limit = paginator.limit(page.limit);
    const cursor = decodeCreatedAtCursor(page.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.playlists.listPublicByOwner(channel.value.userId, {
      cursor: cursor.value && { updatedAt: cursor.value.createdAt, id: cursor.value.id },
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: ({ updatedAt, id }) => createdAtCursorPayload({ createdAt: updatedAt, id }),
        toItem: (playlist) => toChannelPlaylistView(playlist, cdn),
      })
    );
  }

  private async channelView(channel: Channel): Promise<Result<ChannelView, DatabaseUnavailable>> {
    return map(await this.deps.channels.statsOf(channel.userId), (stats) =>
      toChannelView(channel, stats)
    );
  }

  private async findPublicChannel(
    idOrHandle: string
  ): Promise<Result<Channel, GetPublicChannelFailure>> {
    if (UUID_REGEX.test(idOrHandle)) {
      const byId = await this.deps.channels.findById(idOrHandle);
      if (isErr(byId)) return byId;
      if (byId.value) return ok(byId.value);
    }

    const byHandle = await this.deps.channels.findByHandle(idOrHandle.replace(/^@/, ''));
    if (isErr(byHandle)) return byHandle;

    return byHandle.value ? ok(byHandle.value) : err(channelNotFound(idOrHandle));
  }

  /**
   * Creates the user, channel and Watch Later rows a verified identity implies, on its first
   * authenticated request. Every write tolerates losing a race with a concurrent request for the
   * same identity - and only that, so a dead store still surfaces instead of a half-provisioned user.
   */
  async ensureProvisioned(userId: string, email?: string): Promise<Result<void, ProvisionFailure>> {
    const userEmail = email || `${userId}@taitube.local`;

    const existingUser = await this.deps.users.findById(userId);
    if (isErr(existingUser)) return existingUser;

    if (!existingUser.value) {
      const upserted = await this.deps.users.upsert({ id: userId, email: userEmail, tier: 'free' });
      if (isErr(upserted)) return upserted;
    }

    const existingChannel = await this.deps.channels.findByUserId(userId);
    if (isErr(existingChannel)) return existingChannel;
    if (existingChannel.value) return ok();

    // The channel is the "already provisioned" marker, so Watch Later has to exist before it does.
    const watchLater = await this.deps.playlists.provisionWatchLater({
      id: uuidv7(),
      ownerId: userId,
    });
    if (isErr(watchLater)) return watchLater;

    const handle = await this.claimHandle(userEmail, userId);
    if (isErr(handle)) return handle;

    const created = await this.deps.channels.create({
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
      const heldBy = await this.deps.channels.findByHandle(candidate);
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

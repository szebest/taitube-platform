import type { Account, ChannelPlaylistView, OwnerChannel } from '@vp/api-contracts';
import type {
  CaptionRepository,
  ChannelRepositoryPort,
  LiveStreamRepositoryPort,
  PlaylistRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type Channel,
  type UpdateChannelInput,
  type VideoFormat,
  toChannelCard,
} from '@vp/domain';
import {
  type ChannelNotFound,
  type AuthorizationFailure,
  type ClaimHandleFailure,
  type InvalidBrandColor,
  channelNotFound,
  decideChannelTask,
  decideHandleClaim,
  validateBrandColor,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';
import { type InvalidChannelLinks, validateChannelLinks } from '@vp/validation';
import type { ChannelImageService, ResolveChannelImageFailure } from './channel-image-service';
import { type ProvisionFailure, findChannelByIdOrHandle, provisionAccount } from './channel-lookup';
import { type ChannelView, toChannelView } from './channel-views';
import { decodeCreatedAtCursor, createdAtCursorPayload } from './cursor';
import { toChannelPlaylistView } from './library-views';
import type { ListVideosFailure, VideoService, VideoSummaryView } from './video-service';

export interface ChannelServiceDeps {
  users: UserRepository;
  channels: ChannelRepositoryPort;
  captions: Pick<CaptionRepository, 'channelDefault'>;
  liveStreams: Pick<LiveStreamRepositoryPort, 'findOpenByChannel'>;
  playlists: PlaylistRepositoryPort;
  videoService: VideoService;
  paginator: Paginator;
  cdn: CdnBase;
  images: ChannelImageService;
}

export type { ChannelView } from './channel-views';

/** An uploaded image's key replaces the address of the same field. */
export type UpdateChannelCommand = UpdateChannelInput & {
  avatarKey?: string;
  bannerKey?: string;
};

export type UserAccountView = Account;

type AccountNotFound = { readonly code: 'UNAUTHORIZED'; readonly message: string };

export type GetAccountFailure = AccountNotFound | ChannelNotFound | DatabaseUnavailable;
export type UpdateChannelFailure =
  | AuthorizationFailure
  | ChannelNotFound
  | ResolveChannelImageFailure
  | ClaimHandleFailure
  | InvalidBrandColor
  | InvalidChannelLinks
  | DatabaseUnavailable;
export type GetPublicChannelFailure = ChannelNotFound | DatabaseUnavailable;
export type ListChannelVideosFailure = GetPublicChannelFailure | ListVideosFailure;
export type ListChannelPlaylistsFailure =
  | GetPublicChannelFailure
  | InvalidCursor
  | DatabaseUnavailable;

export interface ChannelVideosPage {
  items: VideoSummaryView[];
  nextCursor: string | null;
  total: number;
}

export interface ChannelPlaylistsPage {
  items: ChannelPlaylistView[];
  nextCursor: string | null;
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

    const view = await this.ownerChannelView(channel.value);
    if (isErr(view)) return view;

    return ok({ ...account, role: caller.role, user: account, channel: view.value });
  }

  async updateChannel(
    user: UserContext,
    acting: ActingChannel,
    input: UpdateChannelCommand
  ): Promise<Result<OwnerChannel, UpdateChannelFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-channel' });
    if (isErr(allowed)) return allowed;

    const existing = await this.deps.channels.findById(acting.channelId);
    if (isErr(existing)) return existing;
    if (!existing.value) return err(channelNotFound(acting.channelId));

    let links: UpdateChannelInput['links'];
    if (input.links !== undefined) {
      const checked = validateChannelLinks(input.links);
      if (isErr(checked)) return checked;
      links = checked.value;
    }

    let brandColor: string | null | undefined;
    if (input.brandColor !== undefined) {
      const checked = validateBrandColor(input.brandColor);
      if (isErr(checked)) return checked;
      brandColor = checked.value;
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

    const images = await this.deps.images.addressesOf(existing.value.id, input);
    if (isErr(images)) return images;

    const updated = await this.deps.channels.update(existing.value.id, {
      handle,
      displayName: input.displayName,
      avatarUrl: images.value.avatarUrl,
      bannerUrl: images.value.bannerUrl,
      brandColor,
      bio: input.bio,
      links,
    });
    if (isErr(updated)) return updated;

    return updated.value
      ? await this.ownerChannelView(updated.value)
      : err(channelNotFound(acting.channelId));
  }

  async getPublicChannel(
    idOrHandle: string
  ): Promise<Result<ChannelView, GetPublicChannelFailure>> {
    const channel = await findChannelByIdOrHandle(this.deps.channels, idOrHandle);
    return isErr(channel) ? channel : await this.channelView(channel.value);
  }

  /** Every video of the channel is its own, so the card comes from the lookup, not another read. */
  async listVideos(
    idOrHandle: string,
    page: { cursor?: string; limit?: number; format?: VideoFormat }
  ): Promise<Result<ChannelVideosPage, ListChannelVideosFailure>> {
    const channel = await findChannelByIdOrHandle(this.deps.channels, idOrHandle);
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
    const channel = await findChannelByIdOrHandle(this.deps.channels, idOrHandle);
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
    const stats = await this.deps.channels.statsOf(channel.userId);
    if (isErr(stats)) return stats;
    return map(await this.deps.liveStreams.findOpenByChannel(channel.id), (stream) =>
      toChannelView(channel, stats.value, stream)
    );
  }

  private async ownerChannelView(
    channel: Channel
  ): Promise<Result<OwnerChannel, DatabaseUnavailable>> {
    const view = await this.channelView(channel);
    if (isErr(view)) return view;
    return map(await this.deps.captions.channelDefault(channel.userId), (autoCaptionsDefault) => ({
      ...view.value,
      autoCaptionsDefault,
    }));
  }

  /**
   * Creates the user, channel and Watch Later rows a verified identity implies, on its first
   * authenticated request, and answers the caller's channel.
   */
  ensureProvisioned(userId: string, email?: string): Promise<Result<Channel, ProvisionFailure>> {
    return provisionAccount(this.deps, userId, email);
  }
}

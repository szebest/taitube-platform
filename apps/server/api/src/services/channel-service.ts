import type { Account, ChannelPlaylistView, OwnerChannel } from '@vp/api-contracts';
import type {
  CaptionRepository,
  ChannelPageRepositoryPort,
  ChannelRepositoryPort,
  LiveStreamRepositoryPort,
  PlaylistRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type Channel,
  type ChannelFieldsPatch,
  type ChannelLocalization,
  type VideoFormat,
  pickLocalization,
  toChannelCard,
} from '@vp/domain';
import {
  type ChannelNotFound,
  type AuthorizationFailure,
  channelNotFound,
  decideChannelTask,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';
import type { ChannelIdentityService, IdentityFailure } from './channel-identity-service';
import { type ProvisionFailure, findChannelByIdOrHandle, provisionAccount } from './channel-lookup';
import { type ChannelView, toChannelView, toOwnerExtras } from './channel-views';
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
  identity: ChannelIdentityService;
  pages: Pick<ChannelPageRepositoryPort, 'listLocalizations'>;
  now: () => number;
}

export type { ChannelView } from './channel-views';

export type PublicChannelView = ChannelView & { redirectedFrom: string | null };

export type UpdateChannelCommand = ChannelFieldsPatch & { handle?: string };

export type UserAccountView = Account;

type AccountNotFound = { readonly code: 'UNAUTHORIZED'; readonly message: string };

export type GetAccountFailure = AccountNotFound | ChannelNotFound | DatabaseUnavailable;
export type UpdateChannelFailure =
  | AuthorizationFailure
  | ChannelNotFound
  | IdentityFailure
  | DatabaseUnavailable;
export type GetOwnerChannelFailure = AuthorizationFailure | ChannelNotFound | DatabaseUnavailable;
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

    const identity = await this.deps.identity.decide(existing.value, input);
    if (isErr(identity)) return identity;

    const updated = await this.deps.channels.update(existing.value.id, {
      ...identity.value,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      bannerUrl: input.bannerUrl,
      bio: input.bio,
    });
    if (isErr(updated)) return updated;
    if (!updated.value) return err(channelNotFound(acting.channelId));

    if (identity.value.handle !== undefined) {
      const recorded = await this.deps.identity.recordChange(user, updated.value.id, ['handle']);
      if (isErr(recorded)) return recorded;
    }
    return await this.ownerChannelView(updated.value);
  }

  /** `locales` is the negotiated chain, most preferred first; the channel's own description is the last resort. */
  async getPublicChannel(
    idOrHandle: string,
    locales: readonly string[]
  ): Promise<Result<PublicChannelView, GetPublicChannelFailure>> {
    const match = await this.deps.identity.findPublic(idOrHandle);
    if (isErr(match)) return match;

    const localizations = await this.deps.pages.listLocalizations(match.value.channel.id);
    if (isErr(localizations)) return localizations;

    const view = await this.channelView(
      match.value.channel,
      pickLocalization(localizations.value, locales)
    );
    return map(view, (found) => ({ ...found, redirectedFrom: match.value.redirectedFrom }));
  }

  /** The channel the studio edits: only roles that may edit it read what its team sees. */
  async getOwnerChannel(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<OwnerChannel, GetOwnerChannelFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-channel' });
    if (isErr(allowed)) return allowed;

    const channel = await this.deps.channels.findById(acting.channelId);
    if (isErr(channel)) return channel;
    return channel.value
      ? await this.ownerChannelView(channel.value)
      : err(channelNotFound(acting.channelId));
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

  private async channelView(
    channel: Channel,
    localization: ChannelLocalization | null = null
  ): Promise<Result<ChannelView, DatabaseUnavailable>> {
    const stats = await this.deps.channels.statsOf(channel.userId);
    if (isErr(stats)) return stats;
    return map(await this.deps.liveStreams.findOpenByChannel(channel.id), (stream) =>
      toChannelView(channel, stats.value, stream, { cdn: this.deps.cdn, localization })
    );
  }

  private async ownerChannelView(
    channel: Channel
  ): Promise<Result<OwnerChannel, DatabaseUnavailable>> {
    const view = await this.channelView(channel);
    if (isErr(view)) return view;
    return map(await this.deps.captions.channelDefault(channel.userId), (autoCaptionsDefault) => ({
      ...view.value,
      ...toOwnerExtras(channel, new Date(this.deps.now())),
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

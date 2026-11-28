import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, isErr, map, ok } from '@kit/result';
import type { PlaylistCollaboratorView, PlaylistInviteView } from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  PlaylistCollaboratorRepositoryPort,
  PlaylistRepositoryPort,
} from '@vp/core/repositories';
import {
  type ChannelCard,
  type PlaylistCollaboratorRole,
  type PlaylistInvite,
  type SeatedPlaylist,
  playlistInviteState,
  toChannelCard,
} from '@vp/domain';
import {
  type AcceptPlaylistInviteFailure,
  type LinkInviteFailure,
  type ManagePlaylistFailure,
  type PersonalInviteFailure,
  type PlaylistCollaboratorNotFound,
  type PlaylistInviteInvalid,
  decidePlaylistAction,
  decidePlaylistInvite,
  decidePlaylistInviteAccept,
  decidePlaylistInviteDecline,
  decidePlaylistLeave,
  decidePlaylistLinkInvite,
  playlistCollaboratorNotFound,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { primaryCards } from './playlist-cards';

export interface PlaylistCollaborationServiceDeps {
  playlists: PlaylistRepositoryPort;
  collaborators: PlaylistCollaboratorRepositoryPort;
  channels: Pick<ChannelRepositoryPort, 'findByHandle' | 'findPrimaryByUserIds'>;
  newToken: () => string;
  newId: () => string;
  now: () => number;
}

interface LinkRequest {
  role: PlaylistCollaboratorRole;
  expiresInDays?: number | undefined;
  maxUses: number | null;
}

type Acting = ManagePlaylistFailure | DatabaseUnavailable;
type SeatChange = Acting | PlaylistCollaboratorNotFound;

/** Who works on a playlist, and the invites that seat them: every seat change is the owner's. */
export class PlaylistCollaborationService {
  constructor(private readonly deps: PlaylistCollaborationServiceDeps) {}

  async list(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<{ items: PlaylistCollaboratorView[] }, Acting>> {
    const permitted = await this.decide(actor, playlistId, 'readActivity');
    if (isErr(permitted)) return permitted;
    const seats = await this.deps.collaborators.list(playlistId);
    if (isErr(seats)) return seats;
    const cards = await primaryCards(
      this.deps.channels,
      seats.value.map((seat) => seat.userId)
    );
    return map(cards, (byUser) => ({
      items: seats.value.map(({ userId, role, createdAt }): PlaylistCollaboratorView => ({
        userId,
        role,
        channel: byUser.get(userId) ?? null,
        joinedAt: createdAt.toISOString(),
      })),
    }));
  }

  async invite(
    actor: UserContext,
    playlistId: string,
    request: { handle: string; role: PlaylistCollaboratorRole }
  ): Promise<Result<PlaylistInviteView, PersonalInviteFailure | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const channel = await this.deps.channels.findByHandle(request.handle);
    if (isErr(channel)) return channel;
    const invitee = channel.value ? { userId: channel.value.userId } : null;
    const seats = await this.deps.collaborators.seats(playlistId, invitee?.userId ?? null);
    if (isErr(seats)) return seats;

    const decided = decidePlaylistInvite({
      actor,
      playlist: playlist.value,
      playlistId,
      ...request,
      invitee,
      ...seats.value,
      ...this.fresh(),
    });
    if (isErr(decided)) return decided;
    const created = await this.deps.collaborators.createInvite(decided.value);
    return map(created, (invite) =>
      this.toInviteView(invite, channel.value && toChannelCard(channel.value))
    );
  }

  async createLink(
    actor: UserContext,
    playlistId: string,
    request: LinkRequest
  ): Promise<Result<PlaylistInviteView, LinkInviteFailure | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const seats = await this.deps.collaborators.seats(playlistId, null);
    if (isErr(seats)) return seats;

    const decided = decidePlaylistLinkInvite({
      actor,
      playlist: playlist.value,
      playlistId,
      ...request,
      expiresInDays: request.expiresInDays,
      seated: seats.value.seated,
      ...this.fresh(),
    });
    if (isErr(decided)) return decided;
    const created = await this.deps.collaborators.createInvite(decided.value);
    return map(created, (invite) => this.toInviteView(invite, null));
  }

  async listInvites(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<{ items: PlaylistInviteView[] }, Acting>> {
    const permitted = await this.decide(actor, playlistId, 'manageCollaborators');
    if (isErr(permitted)) return permitted;
    const invites = await this.deps.collaborators.listInvites(playlistId);
    if (isErr(invites)) return invites;
    const cards = await primaryCards(
      this.deps.channels,
      invites.value.flatMap((invite) => (invite.inviteeUserId ? [invite.inviteeUserId] : []))
    );
    return map(cards, (byUser) => ({
      items: invites.value.map((invite) =>
        this.toInviteView(invite, byUser.get(invite.inviteeUserId ?? '') ?? null)
      ),
    }));
  }

  async revokeInvite(
    actor: UserContext,
    playlistId: string,
    inviteId: string
  ): Promise<Result<void, Acting>> {
    const permitted = await this.decide(actor, playlistId, 'manageCollaborators');
    if (isErr(permitted)) return permitted;
    const revoked = await this.deps.collaborators.revokeInvite(
      playlistId,
      inviteId,
      new Date(this.deps.now())
    );
    return map(revoked, () => undefined);
  }

  async accept(
    actor: UserContext,
    token: string
  ): Promise<
    Result<
      { playlistId: string; role: PlaylistCollaboratorRole },
      AcceptPlaylistInviteFailure | DatabaseUnavailable
    >
  > {
    const now = new Date(this.deps.now());
    return await this.deps.collaborators.accept(token, actor.id, (context) =>
      decidePlaylistInviteAccept({ user: actor, ...context, now })
    );
  }

  async decline(
    actor: UserContext,
    token: string
  ): Promise<Result<void, PlaylistInviteInvalid | DatabaseUnavailable>> {
    const invite = await this.deps.collaborators.findInvite(token);
    if (isErr(invite)) return invite;
    const decided = decidePlaylistInviteDecline({ user: actor, invite: invite.value });
    if (isErr(decided)) return decided;
    return map(await this.deps.collaborators.deleteInvite(token), () => undefined);
  }

  async changeRole(
    actor: UserContext,
    playlistId: string,
    userId: string,
    role: PlaylistCollaboratorRole
  ): Promise<Result<void, SeatChange>> {
    const permitted = await this.decide(actor, playlistId, 'manageCollaborators');
    if (isErr(permitted)) return permitted;
    const changed = await this.deps.collaborators.changeRole(playlistId, userId, role, actor.id);
    return this.seatChanged(changed, playlistId, userId);
  }

  async remove(
    actor: UserContext,
    playlistId: string,
    userId: string
  ): Promise<Result<void, SeatChange>> {
    const permitted = await this.decide(actor, playlistId, 'manageCollaborators');
    if (isErr(permitted)) return permitted;
    const removed = await this.deps.collaborators.remove(playlistId, userId, actor.id);
    return this.seatChanged(removed, playlistId, userId);
  }

  async leave(actor: UserContext, playlistId: string): Promise<Result<void, SeatChange>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const decided = decidePlaylistLeave({ actor, playlist: playlist.value, playlistId });
    if (isErr(decided)) return decided;
    const left = await this.deps.collaborators.remove(playlistId, actor.id, actor.id);
    return this.seatChanged(left, playlistId, actor.id);
  }

  private async decide(
    actor: UserContext,
    playlistId: string,
    action: 'readActivity' | 'manageCollaborators'
  ): Promise<Result<SeatedPlaylist, Acting>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    return decidePlaylistAction({ actor, playlist: playlist.value, playlistId }, action);
  }

  private seatChanged(
    changed: Result<boolean, DatabaseUnavailable>,
    playlistId: string,
    userId: string
  ): Result<void, SeatChange> {
    if (isErr(changed)) return changed;
    return changed.value ? ok() : err(playlistCollaboratorNotFound(playlistId, userId));
  }

  private fresh() {
    return { id: this.deps.newId(), token: this.deps.newToken(), now: new Date(this.deps.now()) };
  }

  private toInviteView(invite: PlaylistInvite, invitee: ChannelCard | null): PlaylistInviteView {
    const { id, role, token, expiresAt, maxUses, useCount, createdAt } = invite;
    return {
      id,
      role,
      token,
      invitee,
      state: playlistInviteState(invite, new Date(this.deps.now())),
      expiresAt: expiresAt.toISOString(),
      maxUses,
      useCount,
      createdAt: createdAt.toISOString(),
    };
  }
}

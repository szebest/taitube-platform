import type { Result } from '@kit/result';
import type {
  PlaylistCollaborator,
  PlaylistCollaboratorRole,
  PlaylistInvite,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

/** What the accepting transaction sees under its locks: the invite and the seats as they stand. */
export interface AcceptInviteContext {
  invite: (PlaylistInvite & { ownerId: string }) | null;
  isCollaborator: boolean;
  seated: number;
}

export type AcceptInvitePlan<F> = (
  context: AcceptInviteContext
) => Result<{ playlistId: string; role: PlaylistCollaboratorRole }, F>;

/**
 * Seats on a playlist and the invites to one. Every seat change logs its activity, and a personal
 * invite enqueues its notification, in the same transaction as the write.
 */
export interface PlaylistCollaboratorRepositoryPort {
  list(playlistId: string): Promise<Result<PlaylistCollaborator[], DatabaseUnavailable>>;
  /** How many seats are taken, and whether `userId` holds one. */
  seats(
    playlistId: string,
    userId: string | null
  ): Promise<Result<{ seated: number; isCollaborator: boolean }, DatabaseUnavailable>>;
  /** A personal invite replaces any earlier one to the same person on the same playlist. */
  createInvite(invite: PlaylistInvite): Promise<Result<PlaylistInvite, DatabaseUnavailable>>;
  /** Newest first, revoked ones left out. */
  listInvites(playlistId: string): Promise<Result<PlaylistInvite[], DatabaseUnavailable>>;
  findInvite(token: string): Promise<Result<PlaylistInvite | null, DatabaseUnavailable>>;
  findInviteById(id: string): Promise<Result<PlaylistInvite | null, DatabaseUnavailable>>;
  revokeInvite(
    playlistId: string,
    inviteId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Deletes a personal invite; false when there was none for that token. */
  deleteInvite(token: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Locks the invite and the playlist, asks the plan, then seats the caller and uses the invite. */
  accept<F>(
    token: string,
    userId: string,
    plan: AcceptInvitePlan<F>
  ): Promise<Result<{ playlistId: string; role: PlaylistCollaboratorRole }, DatabaseUnavailable | F>>;
  changeRole(
    playlistId: string,
    userId: string,
    role: PlaylistCollaboratorRole,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  remove(
    playlistId: string,
    userId: string,
    actorId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}

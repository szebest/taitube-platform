import type { PlaylistCollaboratorRole } from '@vp/domain';

type PlaylistVisibility = 'public' | 'unlisted' | 'private';

/**
 * `collaboratorId` and `collaboratorRole` are the caller's own seat, resolved by the repository: a
 * rule matches them against the caller's id, so a seat resolved for someone else grants nothing.
 * `addedBy` is set when the check is about one item.
 */
export interface PlaylistResource {
  readonly id?: string;
  readonly ownerId?: string;
  readonly visibility?: PlaylistVisibility;
  readonly collaboratorId?: string | null;
  readonly collaboratorRole?: PlaylistCollaboratorRole | null;
  readonly addedBy?: string | null;
}

export interface PlaylistStatsResource {
  readonly ownerId: string;
}

/** `inviteeUserId` is null on a link invite, which anyone signed in may take. */
export interface PlaylistInviteResource {
  readonly inviteeUserId?: string | null;
}

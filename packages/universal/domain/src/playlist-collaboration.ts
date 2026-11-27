import { MS_PER_DAY } from '@kit/primitives';
import type { Playlist } from './playlist';

export const PLAYLIST_COLLABORATOR_ROLES = ['editor', 'contributor'] as const;
export type PlaylistCollaboratorRole = (typeof PLAYLIST_COLLABORATOR_ROLES)[number];

export const MAX_PLAYLIST_COLLABORATORS = 20;

export const PLAYLIST_INVITE_DEFAULT_DAYS = 7;
export const PLAYLIST_INVITE_MAX_DAYS = 30;
export const PLAYLIST_INVITE_MAX_USES = 20;

/** A playlist with one caller's seat on it, as the repository resolves it for that caller. */
export interface SeatedPlaylist extends Playlist {
  readonly collaboratorId: string | null;
  readonly collaboratorRole: PlaylistCollaboratorRole | null;
}

export const PLAYLIST_VIEWER_ROLES = ['owner', ...PLAYLIST_COLLABORATOR_ROLES] as const;
type PlaylistViewerRole = (typeof PLAYLIST_VIEWER_ROLES)[number];

/** Where one caller stands on a playlist: their seat on it, if any, and whether they follow it. */
export interface PlaylistViewerState {
  readonly role: PlaylistViewerRole | null;
  readonly following: boolean;
}

export interface PlaylistCollaborator {
  readonly playlistId: string;
  readonly userId: string;
  readonly role: PlaylistCollaboratorRole;
  readonly addedBy: string | null;
  readonly createdAt: Date;
}

/**
 * A personal invite names its invitee and is used once; a link invite names nobody and admits up to
 * `maxUses` people, or anyone while `maxUses` is null.
 */
export interface PlaylistInvite {
  readonly id: string;
  readonly playlistId: string;
  readonly role: PlaylistCollaboratorRole;
  readonly token: string;
  readonly inviteeUserId: string | null;
  readonly createdBy: string | null;
  readonly expiresAt: Date;
  readonly maxUses: number | null;
  readonly useCount: number;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export type PlaylistInviteState = 'active' | 'expired' | 'revoked' | 'exhausted';

/** Revoked wins, then expired, so the reason shown is the owner's act before the clock. */
export function playlistInviteState(
  invite: Pick<PlaylistInvite, 'expiresAt' | 'revokedAt' | 'maxUses' | 'useCount'>,
  now: Date
): PlaylistInviteState {
  if (invite.revokedAt !== null) return 'revoked';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return 'exhausted';
  return 'active';
}

export function playlistInviteExpiresAt(days: number, now: Date): Date {
  return new Date(now.getTime() + days * MS_PER_DAY);
}

/** Who hears of a change: everyone on the playlist but the person who made it. */
export function playlistAudience(
  ownerId: string,
  collaboratorIds: readonly string[],
  actorId: string
): string[] {
  return [ownerId, ...collaboratorIds].filter((userId) => userId !== actorId);
}

/** The hour a change falls in: the owner hears of each collaborator's changes once an hour. */
export function playlistUpdateHour(at: Date): string {
  return at.toISOString().slice(0, 13);
}

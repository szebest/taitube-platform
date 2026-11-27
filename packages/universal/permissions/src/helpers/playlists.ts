import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type {
  AppAction,
  PlaylistInviteResource,
  PlaylistResource,
  UserContext,
} from '../types/index';

interface PlaylistCheck {
  user: UserContext | null;
  playlist: PlaylistResource;
}

type PlaylistAction = Extract<
  AppAction,
  | 'read'
  | 'update'
  | 'delete'
  | 'addItem'
  | 'removeItem'
  | 'manageItems'
  | 'manageCollaborators'
  | 'readActivity'
  | 'restoreItem'
>;

function can(action: PlaylistAction, { user, playlist }: PlaylistCheck, field?: string): boolean {
  return getUserPermissions(user).can(action, subject('Playlist', { ...playlist }), field);
}

export function canCreatePlaylist({ user }: { user: UserContext | null }): boolean {
  return getUserPermissions(user).can('create', 'Playlist');
}

export function canReadPlaylist(check: PlaylistCheck): boolean {
  return can('read', check);
}

/** Without `field`, whether the caller may change anything at all; with it, that one field. */
export function canUpdatePlaylist(check: PlaylistCheck & { field?: string }): boolean {
  return can('update', check, check.field);
}

export function canDeletePlaylist(check: PlaylistCheck): boolean {
  return can('delete', check);
}

export function canAddPlaylistItem(check: PlaylistCheck): boolean {
  return can('addItem', check);
}

/** About one item: `playlist.addedBy` is who added it. */
export function canRemovePlaylistItem(check: PlaylistCheck): boolean {
  return can('removeItem', check);
}

/**
 * Reordering, sorting and sections when `playlist.addedBy` is absent; annotating one item when it
 * names that item's adder.
 */
export function canManagePlaylistItems(check: PlaylistCheck): boolean {
  return can('manageItems', check);
}

export function canManagePlaylistCollaborators(check: PlaylistCheck): boolean {
  return can('manageCollaborators', check);
}

export function canReadPlaylistActivity(check: PlaylistCheck): boolean {
  return can('readActivity', check);
}

export function canRestorePlaylistItem(check: PlaylistCheck): boolean {
  return can('restoreItem', check);
}

interface InviteCheck {
  user: UserContext | null;
  invite: PlaylistInviteResource;
}

/** A link invite is anyone's to take; a personal one only its invitee's. */
export function canAcceptPlaylistInvite({ user, invite }: InviteCheck): boolean {
  return getUserPermissions(user).can('update', subject('PlaylistInvite', { ...invite }));
}

export function canDeclinePlaylistInvite({ user, invite }: InviteCheck): boolean {
  return getUserPermissions(user).can('delete', subject('PlaylistInvite', { ...invite }));
}

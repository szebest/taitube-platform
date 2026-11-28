import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type {
  AppAction,
  PlaylistInviteResource,
  PlaylistResource,
  PlaylistStatsResource,
  ShareGrant,
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
  | 'pin'
  | 'subscribe'
>;

function can(action: PlaylistAction, { user, playlist }: PlaylistCheck, field?: string): boolean {
  return getUserPermissions(user).can(action, subject('Playlist', { ...playlist }), field);
}

export function canCreatePlaylist({ user }: { user: UserContext | null }): boolean {
  return getUserPermissions(user).can('create', 'Playlist');
}

/** `share` is a live link the caller holds; it grants `read` on its own playlist and on no other. */
export function canReadPlaylist({
  user,
  playlist,
  share = null,
}: PlaylistCheck & { share?: ShareGrant | null }): boolean {
  return getUserPermissions(user, share).can('read', subject('Playlist', { ...playlist }));
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

export function canPinPlaylist(check: PlaylistCheck): boolean {
  return can('pin', check);
}

/** Following needs a playlist the caller can read and does not own. */
export function canFollowPlaylist(check: PlaylistCheck): boolean {
  return can('subscribe', check);
}

export function canReadPlaylistStats({
  user,
  stats,
}: {
  user: UserContext | null;
  stats: PlaylistStatsResource;
}): boolean {
  return getUserPermissions(user).can('read', subject('PlaylistStats', { ...stats }));
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

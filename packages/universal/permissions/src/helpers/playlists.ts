import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { PlaylistResource, UserContext } from '../types/index';

interface PlaylistCheck {
  user: UserContext | null;
  playlist: PlaylistResource;
}

export function canCreatePlaylist({ user }: { user: UserContext | null }): boolean {
  return getUserPermissions(user).can('create', 'Playlist');
}

export function canReadPlaylist({ user, playlist }: PlaylistCheck): boolean {
  return getUserPermissions(user).can('read', subject('Playlist', { ...playlist }));
}

export function canUpdatePlaylist({ user, playlist }: PlaylistCheck): boolean {
  return getUserPermissions(user).can('update', subject('Playlist', { ...playlist }));
}

export function canDeletePlaylist({ user, playlist }: PlaylistCheck): boolean {
  return getUserPermissions(user).can('delete', subject('Playlist', { ...playlist }));
}

/** Adding, removing and reordering items is an edit of the playlist, so it is the owner's call. */
export function canManagePlaylistItems(check: PlaylistCheck): boolean {
  return canUpdatePlaylist(check);
}

import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';

/** A private playlist is its owner's alone; an unlisted one is readable by anyone with the link. */
export function definePlaylistRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  can('read', 'Playlist', { visibility: 'public' });
  can('read', 'Playlist', { visibility: 'unlisted' });

  if (!(user && isSignedInRole(user.role))) {
    return;
  }

  can('create', 'Playlist');
  can('read', 'Playlist', { ownerId: user.id });
  can('update', 'Playlist', { ownerId: user.id });
  can('delete', 'Playlist', { ownerId: user.id });
}

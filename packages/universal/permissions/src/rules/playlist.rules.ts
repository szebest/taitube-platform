import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';

const OWNER_ACTIONS = [
  'read',
  'update',
  'delete',
  'addItem',
  'removeItem',
  'manageItems',
  'manageCollaborators',
  'readActivity',
  'restoreItem',
  'pin',
] as const;

/**
 * A private playlist is its owner's and its collaborators'; an unlisted one is readable by anyone
 * with the link. An editor curates the list and its words, never its visibility or kind; a
 * contributor adds, and removes or annotates only what they added. Anyone signed in follows a
 * playlist they can read and is not the owner of; its stats are the owner's alone.
 */
export function definePlaylistRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can, cannot } = builder;

  can('read', 'Playlist', { visibility: 'public' });
  can('read', 'Playlist', { visibility: 'unlisted' });

  if (!(user && isSignedInRole(user.role))) {
    return;
  }

  can('create', 'Playlist');
  can([...OWNER_ACTIONS], 'Playlist', { ownerId: user.id });
  can('subscribe', 'Playlist');
  cannot('subscribe', 'Playlist', { ownerId: user.id });
  can('read', 'PlaylistStats', { ownerId: user.id });

  can(['read', 'readActivity'], 'Playlist', { collaboratorId: user.id });

  const editor = { collaboratorId: user.id, collaboratorRole: 'editor' } as const;
  can(['addItem', 'removeItem', 'manageItems'], 'Playlist', editor);
  can('update', 'Playlist', ['title', 'description'], editor);

  const contributor = { collaboratorId: user.id, collaboratorRole: 'contributor' } as const;
  can('addItem', 'Playlist', contributor);
  can(['removeItem', 'manageItems'], 'Playlist', { ...contributor, addedBy: user.id });

  can('update', 'PlaylistInvite', { inviteeUserId: null });
  can(['update', 'delete'], 'PlaylistInvite', { inviteeUserId: user.id });
}

import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { PlaylistResource, UserContext } from '../../types/index';
import {
  canCreatePlaylist,
  canDeletePlaylist,
  canManagePlaylistItems,
  canReadPlaylist,
  canUpdatePlaylist,
} from '../playlists';

const privatePlaylist: PlaylistResource = {
  id: 'pl-1',
  ownerId: creatorUser.id,
  visibility: 'private',
};

const CHECKS = {
  create: (user: UserContext | null) => canCreatePlaylist({ user }),
  read: (user: UserContext | null) => canReadPlaylist({ user, playlist: privatePlaylist }),
  update: (user: UserContext | null) => canUpdatePlaylist({ user, playlist: privatePlaylist }),
  delete: (user: UserContext | null) => canDeletePlaylist({ user, playlist: privatePlaylist }),
  items: (user: UserContext | null) => canManagePlaylistItems({ user, playlist: privatePlaylist }),
};

type Action = keyof typeof CHECKS;

describe('helpers/playlists: who may do what to a private playlist', () => {
  it.each<{ user: UserContext | null; who: string; allowed: Action[] }>([
    { who: 'a guest', user: guestUser, allowed: [] },
    { who: 'a stranger', user: standardUser, allowed: ['create'] },
    {
      who: 'the owner',
      user: creatorUser,
      allowed: ['create', 'read', 'update', 'delete', 'items'],
    },
    { who: 'an admin', user: adminUser, allowed: ['create', 'read', 'update', 'delete', 'items'] },
  ])('$who may $allowed', ({ user, allowed }) => {
    const granted = (Object.keys(CHECKS) as Action[]).filter((action) => CHECKS[action](user));

    expect(granted).toEqual(allowed);
  });

  it.each(['public', 'unlisted'] as const)('lets a guest read a %s playlist', (visibility) => {
    expect(canReadPlaylist({ user: guestUser, playlist: { ...privatePlaylist, visibility } })).toBe(
      true
    );
  });
});

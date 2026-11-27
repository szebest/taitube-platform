import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { PlaylistResource, UserContext } from '../../types/index';
import {
  canAcceptPlaylistInvite,
  canAddPlaylistItem,
  canCreatePlaylist,
  canDeclinePlaylistInvite,
  canDeletePlaylist,
  canManagePlaylistCollaborators,
  canManagePlaylistItems,
  canReadPlaylist,
  canReadPlaylistActivity,
  canRemovePlaylistItem,
  canRestorePlaylistItem,
  canUpdatePlaylist,
} from '../playlists';

const privatePlaylist: PlaylistResource = {
  id: 'pl-1',
  ownerId: creatorUser.id,
  visibility: 'private',
};

const seatOf = (user: UserContext | null): PlaylistResource =>
  user?.id === standardUser.id
    ? { ...privatePlaylist, collaboratorId: user.id, collaboratorRole: 'contributor' }
    : privatePlaylist;

const CHECKS = {
  create: (user: UserContext | null) => canCreatePlaylist({ user }),
  read: (user: UserContext | null) => canReadPlaylist({ user, playlist: seatOf(user) }),
  update: (user: UserContext | null) => canUpdatePlaylist({ user, playlist: seatOf(user) }),
  visibility: (user: UserContext | null) =>
    canUpdatePlaylist({ user, playlist: seatOf(user), field: 'visibility' }),
  delete: (user: UserContext | null) => canDeletePlaylist({ user, playlist: seatOf(user) }),
  add: (user: UserContext | null) => canAddPlaylistItem({ user, playlist: seatOf(user) }),
  remove: (user: UserContext | null) =>
    canRemovePlaylistItem({ user, playlist: { ...seatOf(user), addedBy: creatorUser.id } }),
  items: (user: UserContext | null) => canManagePlaylistItems({ user, playlist: seatOf(user) }),
  seats: (user: UserContext | null) =>
    canManagePlaylistCollaborators({ user, playlist: seatOf(user) }),
  log: (user: UserContext | null) => canReadPlaylistActivity({ user, playlist: seatOf(user) }),
  restore: (user: UserContext | null) => canRestorePlaylistItem({ user, playlist: seatOf(user) }),
};

const EVERYTHING: Action[] = [
  'create',
  'read',
  'update',
  'visibility',
  'delete',
  'add',
  'remove',
  'items',
  'seats',
  'log',
  'restore',
];

type Action = keyof typeof CHECKS;

describe('helpers/playlists: who may do what to a private playlist', () => {
  it.each<{ user: UserContext | null; who: string; allowed: Action[] }>([
    { who: 'a guest', user: guestUser, allowed: [] },
    { who: 'a stranger', user: moderatorUser, allowed: ['create'] },
    { who: 'a contributor', user: standardUser, allowed: ['create', 'read', 'add', 'log'] },
    { who: 'the owner', user: creatorUser, allowed: EVERYTHING },
    { who: 'an admin', user: adminUser, allowed: EVERYTHING },
  ])('$who may $allowed', ({ user, allowed }) => {
    const granted = (Object.keys(CHECKS) as Action[]).filter((action) => CHECKS[action](user));

    expect(granted).toEqual(allowed);
  });

  it.each(['public', 'unlisted'] as const)('lets a guest read a %s playlist', (visibility) => {
    expect(canReadPlaylist({ user: guestUser, playlist: { ...privatePlaylist, visibility } })).toBe(
      true
    );
  });

  it.each([
    { scenario: 'a link', invitee: null, user: standardUser, accept: true, decline: false },
    {
      scenario: 'a link, signed out',
      invitee: null,
      user: guestUser,
      accept: false,
      decline: false,
    },
    {
      scenario: 'their own invite',
      invitee: standardUser.id,
      user: standardUser,
      accept: true,
      decline: true,
    },
    {
      scenario: "someone else's invite",
      invitee: 'someone',
      user: standardUser,
      accept: false,
      decline: false,
    },
  ])('takes $scenario: accept $accept, decline $decline', ({ invitee, user, accept, decline }) => {
    const invite = { inviteeUserId: invitee };

    expect([
      canAcceptPlaylistInvite({ user, invite }),
      canDeclinePlaylistInvite({ user, invite }),
    ]).toEqual([accept, decline]);
  });
});

import { renderHook } from '@testing-library/react';
import type { PlaylistView } from '@vp/api-contracts';
import { PermissionsProvider } from '@vp/permissions-react';
import { account, OWNER_ID } from '@vp/web-testing';
import type { PropsWithChildren } from 'react';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { type PlaylistAbilities, usePlaylistAbilities } from '../use-playlist-abilities';

const LIST = uuid(4100);
const VIEWER = uuid(9001);

const NONE: PlaylistAbilities = {
  follow: false,
  pin: false,
  seeCollaborators: false,
  manageCollaborators: false,
  leave: false,
  readActivity: false,
  restore: false,
  readStats: false,
  share: false,
  configure: false,
  editRules: false,
  delete: false,
};

const OWNER: PlaylistAbilities = {
  ...NONE,
  pin: true,
  seeCollaborators: true,
  manageCollaborators: true,
  readActivity: true,
  restore: true,
  readStats: true,
  share: true,
  configure: true,
  editRules: true,
  delete: true,
};

const SEATED: PlaylistAbilities = {
  ...NONE,
  follow: true,
  seeCollaborators: true,
  leave: true,
  readActivity: true,
};

const READER: PlaylistAbilities = { ...NONE, follow: true };

function renderAbilities(
  Session: ReturnType<typeof signedIn>,
  user: { id: string; role: 'USER' | 'GUEST' } | null,
  role: PlaylistView['viewer']['role']
) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <Session>
      <PermissionsProvider userContext={user}>{children}</PermissionsProvider>
    </Session>
  );
  const playlist = playlistDetail(LIST, [], {
    visibility: 'public',
    viewer: { role, following: false },
  });
  return renderHook(() => usePlaylistAbilities(playlist), { wrapper }).result;
}

describe('apps/client/web: usePlaylistAbilities', () => {
  it.each([
    {
      viewer: 'the owner',
      Session: signedIn(),
      user: { id: OWNER_ID, role: 'USER' },
      role: 'owner',
      abilities: OWNER,
    },
    {
      viewer: 'an editor',
      Session: signedIn(account({ id: VIEWER })),
      user: { id: VIEWER, role: 'USER' },
      role: 'editor',
      abilities: SEATED,
    },
    {
      viewer: 'a contributor',
      Session: signedIn(account({ id: VIEWER })),
      user: { id: VIEWER, role: 'USER' },
      role: 'contributor',
      abilities: SEATED,
    },
    {
      viewer: 'a signed-in reader with no seat',
      Session: signedIn(account({ id: VIEWER })),
      user: { id: VIEWER, role: 'USER' },
      role: null,
      abilities: READER,
    },
    {
      viewer: 'a guest',
      Session: AppProviders,
      user: null,
      role: null,
      abilities: NONE,
    },
  ] as const)(
    'gives $viewer exactly what their seat allows',
    ({ Session, user, role, abilities }) => {
      expect(renderAbilities(Session, user, role).current).toEqual(abilities);
    }
  );
});

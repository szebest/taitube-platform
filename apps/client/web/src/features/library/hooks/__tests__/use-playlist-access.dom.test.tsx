import { renderHook } from '@testing-library/react';
import type { PlaylistView } from '@vp/api-contracts';
import { account, OWNER_ID } from '@vp/web-testing';
import type { ComponentType, PropsWithChildren } from 'react';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { usePlaylistAccess } from '../use-playlist-access';

const LIST = uuid(4100);
const VIEWER = uuid(9001);

function renderAccess(
  Providers: ComponentType<PropsWithChildren>,
  role: PlaylistView['viewer']['role']
) {
  const playlist = playlistDetail(LIST, [], { viewer: { role, following: false } });
  return renderHook(() => usePlaylistAccess(playlist), { wrapper: Providers }).result;
}

describe('apps/client/web: usePlaylistAccess', () => {
  it.each([
    { viewer: 'the owner', Providers: signedIn(), role: 'owner', seat: null, seatRole: null },
    {
      viewer: 'an editor',
      Providers: signedIn(account({ id: VIEWER })),
      role: 'editor',
      seat: VIEWER,
      seatRole: 'editor',
    },
    {
      viewer: 'a contributor',
      Providers: signedIn(account({ id: VIEWER })),
      role: 'contributor',
      seat: VIEWER,
      seatRole: 'contributor',
    },
    {
      viewer: 'a stranger',
      Providers: signedIn(account({ id: VIEWER })),
      role: null,
      seat: null,
      seatRole: null,
    },
    { viewer: 'a guest', Providers: AppProviders, role: null, seat: null, seatRole: null },
  ] as const)(
    'gives $viewer the seat $seatRole from the read',
    ({ Providers, role, seat, seatRole }) => {
      expect(renderAccess(Providers, role).current).toEqual({
        id: LIST,
        ownerId: OWNER_ID,
        visibility: 'private',
        collaboratorId: seat,
        collaboratorRole: seatRole,
      });
    }
  );
});

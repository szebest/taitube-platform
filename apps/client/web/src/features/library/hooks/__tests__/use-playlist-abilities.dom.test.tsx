import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { listPlaylistCollaborators } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { PermissionsProvider } from '@vp/permissions-react';
import { createQueryClient } from '@vp/queries';
import { account, apiServer, mockEndpoint, OWNER_ID, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { NOW, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
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

const seat = (role: 'editor' | 'contributor') => () =>
  HttpResponse.json({ items: [{ userId: VIEWER, role, channel: null, joinedAt: NOW }] });

const READER: PlaylistAbilities = { ...NONE, follow: true };

function renderAbilities(
  Session: ReturnType<typeof signedIn>,
  user: { id: string; role: 'USER' | 'GUEST' } | null,
  reply: () => Response
) {
  apiServer.use(mockEndpoint(listPlaylistCollaborators, reply));
  const client = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <Session>
        <PermissionsProvider userContext={user}>{children}</PermissionsProvider>
      </Session>
    </QueryClientProvider>
  );
  return renderHook(
    () => usePlaylistAbilities(playlistDetail(LIST, [], { visibility: 'public' })),
    { wrapper }
  ).result;
}

describe('apps/client/web: usePlaylistAbilities', () => {
  it.each([
    {
      viewer: 'the owner',
      Session: signedIn(),
      user: { id: OWNER_ID, role: 'USER' },
      reply: seat('editor'),
      abilities: OWNER,
    },
    {
      viewer: 'an editor',
      Session: signedIn(account({ id: VIEWER })),
      user: { id: VIEWER, role: 'USER' },
      reply: seat('editor'),
      abilities: SEATED,
    },
    {
      viewer: 'a contributor',
      Session: signedIn(account({ id: VIEWER })),
      user: { id: VIEWER, role: 'USER' },
      reply: seat('contributor'),
      abilities: SEATED,
    },
    {
      viewer: 'a signed-in reader with no seat',
      Session: signedIn(account({ id: VIEWER })),
      user: { id: VIEWER, role: 'USER' },
      reply: () => problemReply(ErrorCodes.FORBIDDEN),
      abilities: READER,
    },
    {
      viewer: 'a guest',
      Session: AppProviders,
      user: null,
      reply: seat('editor'),
      abilities: NONE,
    },
  ] as const)(
    'gives $viewer exactly what their seat allows',
    async ({ Session, user, reply, abilities }) => {
      const result = renderAbilities(Session, user, reply);

      await waitFor(() => expect(result.current).toEqual(abilities));
    }
  );
});

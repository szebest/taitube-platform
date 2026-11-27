import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { listPlaylistCollaborators } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { account, apiServer, mockEndpoint, OWNER_ID, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';
import { NOW, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { usePlaylistAccess } from '../use-playlist-access';

const LIST = uuid(4100);
const VIEWER = uuid(9001);

function renderAccess(Providers: ComponentType<PropsWithChildren>, reply: () => Response) {
  const asked = vi.fn(reply);
  apiServer.use(mockEndpoint(listPlaylistCollaborators, () => asked()));
  const client = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <Providers>{children}</Providers>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => usePlaylistAccess(playlistDetail(LIST, [])), { wrapper });
  return { result, asked };
}

const seated = (role: 'editor' | 'contributor') => () =>
  HttpResponse.json({ items: [{ userId: VIEWER, role, channel: null, joinedAt: NOW }] });

describe('apps/client/web: usePlaylistAccess', () => {
  it.each([
    {
      viewer: 'the owner',
      Providers: signedIn(),
      reply: seated('editor'),
      seat: null,
      role: null,
      asks: false,
    },
    {
      viewer: 'an editor',
      Providers: signedIn(account({ id: VIEWER })),
      reply: seated('editor'),
      seat: VIEWER,
      role: 'editor',
      asks: true,
    },
    {
      viewer: 'a contributor',
      Providers: signedIn(account({ id: VIEWER })),
      reply: seated('contributor'),
      seat: VIEWER,
      role: 'contributor',
      asks: true,
    },
    {
      viewer: 'a stranger the list is refused to',
      Providers: signedIn(account({ id: VIEWER })),
      reply: () => problemReply(ErrorCodes.FORBIDDEN),
      seat: null,
      role: null,
      asks: true,
    },
    {
      viewer: 'a guest',
      Providers: AppProviders,
      reply: seated('editor'),
      seat: null,
      role: null,
      asks: false,
    },
  ])('gives $viewer the seat $role', async ({ Providers, reply, seat, role, asks }) => {
    const { result, asked } = renderAccess(Providers, reply);

    await waitFor(() => expect(asked).toHaveBeenCalledTimes(asks ? 1 : 0));
    await waitFor(() =>
      expect(result.current).toEqual({
        id: LIST,
        ownerId: OWNER_ID,
        visibility: 'private',
        collaboratorId: seat,
        collaboratorRole: role,
      })
    );
  });
});

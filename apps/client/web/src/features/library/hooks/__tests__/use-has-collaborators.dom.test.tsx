import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { listPlaylistCollaborators, type PlaylistView } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, channel, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { libraryVideo, NOW, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { signedIn } from '#app/__tests__/providers';
import { useHasCollaborators } from '../use-has-collaborators';

const OTHER = uuid(9001);
const { id, handle, displayName, avatarUrl } = channel();

function renderHasCollaborators(playlist: PlaylistView, collaborators: number) {
  apiServer.use(
    mockEndpoint(listPlaylistCollaborators, () =>
      HttpResponse.json({
        items: Array.from({ length: collaborators }, () => ({
          userId: OTHER,
          role: 'editor' as const,
          channel: null,
          joinedAt: NOW,
        })),
      })
    )
  );
  const client = createQueryClient();
  const Providers = signedIn();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <Providers>{children}</Providers>
    </QueryClientProvider>
  );
  return renderHook(() => useHasCollaborators(playlist), { wrapper }).result;
}

const playlist = playlistDetail(uuid(4100), [libraryVideo(1)]);
const addedByOther = {
  ...playlist,
  items: playlist.items.map((item) => ({
    ...item,
    addedBy: { userId: OTHER, channel: { id, handle, displayName, avatarUrl } },
  })),
};

describe('apps/client/web: useHasCollaborators', () => {
  it.each([
    { case: 'an item someone else added', playlist: addedByOther, collaborators: 0, shown: true },
    { case: 'a collaborator on the list', playlist, collaborators: 1, shown: true },
    { case: 'only the owner', playlist, collaborators: 0, shown: false },
    {
      case: 'a reader without a seat, who may not list them',
      playlist: { ...playlist, viewer: { role: null, following: false } },
      collaborators: 1,
      shown: false,
    },
  ])('is $shown for $case', async ({ playlist: read, collaborators, shown }) => {
    const result = renderHasCollaborators(read, collaborators);

    await waitFor(() => expect(result.current).toBe(shown));
  });
});

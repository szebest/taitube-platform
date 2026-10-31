import { addPlaylistItem, createPlaylist } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/features/library/__tests__/library-fixtures';
import { libraryKeys } from '#app/features/library/api/library-queries';
import { useCreatePlaylist } from '../use-create-playlist';
import { renderWithToasts } from './toast-harness';

const CREATED = uuid(4900);

function serve() {
  const writes: string[] = [];
  apiServer.use(
    mockEndpoint(createPlaylist, async ({ request }) => {
      writes.push(`create ${JSON.stringify(await request.json())}`);
      return HttpResponse.json(playlistDetail(CREATED, [], { title: 'Trips' }), { status: 201 });
    }),
    mockEndpoint(addPlaylistItem, async ({ params, request }) => {
      writes.push(`add ${params.id} ${JSON.stringify(await request.json())}`);
      return HttpResponse.json(playlistDetail(CREATED, []), { status: 201 });
    })
  );
  return writes;
}

describe('apps/client/web: useCreatePlaylist', () => {
  it.each([
    {
      scenario: 'an empty playlist',
      videoId: undefined,
      writes: [`create {"title":"Trips","visibility":"private"}`],
      title: 'Created Trips',
    },
    {
      scenario: 'a playlist that starts with a video',
      videoId: uuid(7),
      writes: [
        `create {"title":"Trips","visibility":"private"}`,
        `add ${CREATED} {"videoId":"${uuid(7)}"}`,
      ],
      title: 'Saved to Trips',
    },
  ])('creates $scenario and says so', async ({ videoId, writes, title }) => {
    const sent = serve();
    const client = createQueryClient();
    const { result, show } = renderWithToasts(useCreatePlaylist, client);

    await result.current.mutateAsync({ title: 'Trips', visibility: 'private', videoId });

    expect(sent).toEqual(writes);
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success', title }));
  });

  it('marks the playlists it lists stale', async () => {
    serve();
    const client = createQueryClient();
    client.setQueryData(libraryKeys.playlists(), { items: [] });
    const { result } = renderWithToasts(useCreatePlaylist, client);

    await result.current.mutateAsync({ title: 'Trips', visibility: 'private' });

    expect(client.getQueryState(libraryKeys.playlists())?.isInvalidated).toBe(true);
  });
});

import { pinPlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { usePinPlaylist } from '../use-pin-playlist';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const KEY = playlistQueryOptions(api, LIST).queryKey;

function pinWith(reply: () => Response) {
  apiServer.use(mockEndpoint(pinPlaylist, reply));
  const client = createQueryClient();
  client.setQueryData(KEY, playlistDetail(LIST, []));
  client.setQueryData(libraryKeys.playlists(), { items: [] });
  const { result, show } = renderWithToasts(() => usePinPlaylist(LIST), client);
  return { client, show, pin: () => result.current.mutateAsync(true).catch(() => undefined) };
}

describe('apps/client/web: usePinPlaylist', () => {
  it('shows the pin at once and marks the shelves stale', async () => {
    const { client, show, pin } = pinWith(() => new HttpResponse(null, { status: 204 }));

    await pin();

    expect(client.getQueryData(KEY)?.pinnedAt).not.toBeNull();
    expect(client.getQueryState(libraryKeys.playlists())?.isInvalidated).toBe(true);
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pinned to your library' }));
  });

  it('takes the pin back and says why when the pins are full', async () => {
    const { client, show, pin } = pinWith(() => problemReply(ErrorCodes.PLAYLIST_PIN_LIMIT));

    await pin();

    expect(client.getQueryData(KEY)?.pinnedAt).toBeNull();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        description: 'You have pinned the most playlists you can. Unpin one first.',
      })
    );
  });
});

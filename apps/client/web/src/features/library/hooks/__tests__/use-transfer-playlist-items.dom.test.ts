import { transferPlaylistItems } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useTransferPlaylistItems } from '../use-transfer-playlist-items';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const TARGET = uuid(4101);

describe('apps/client/web: useTransferPlaylistItems', () => {
  it('sends the items with their target and marks both playlists and the list of them stale', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(transferPlaylistItems, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json({ playlistId: TARGET, results: [] });
      })
    );
    const client = createQueryClient();
    client.setQueryData(libraryKeys.playlist(TARGET), null);
    client.setQueryData(libraryKeys.playlists(), { items: [] });
    const { result } = renderWithToasts(() => useTransferPlaylistItems(LIST), client);

    await result.current.mutateAsync({ itemIds: [uuid(5000)], to: TARGET, mode: 'move' });

    expect(bodies).toEqual([{ itemIds: [uuid(5000)], to: TARGET, mode: 'move' }]);
    expect(client.getQueryState(libraryKeys.playlist(TARGET))?.isInvalidated).toBe(true);
    expect(client.getQueryState(libraryKeys.playlists())?.isInvalidated).toBe(true);
  });
});

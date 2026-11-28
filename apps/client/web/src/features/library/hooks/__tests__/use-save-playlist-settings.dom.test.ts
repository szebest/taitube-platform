import { updatePlaylist } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { renderMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { AppProviders } from '#app/__tests__/providers';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { useSavePlaylistSettings } from '../use-save-playlist-settings';

const LIST = uuid(4100);

describe('apps/client/web: useSavePlaylistSettings', () => {
  it('sends the settings and keeps the playlist the API answers with', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(updatePlaylist, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(playlistDetail(LIST, [], { autoRemoveWatched: true }));
      })
    );
    const client = createQueryClient();
    client.setQueryData(libraryKeys.playlists(), { items: [] });
    const result = renderMutation(() => useSavePlaylistSettings(LIST), client, AppProviders);

    await result.current.mutateAsync({ autoRemoveWatched: true });

    expect(bodies).toEqual([{ autoRemoveWatched: true }]);
    expect(client.getQueryData(playlistQueryOptions(api, LIST).queryKey)?.autoRemoveWatched).toBe(
      true
    );
    expect(client.getQueryState(libraryKeys.playlists())?.isInvalidated).toBe(true);
  });
});

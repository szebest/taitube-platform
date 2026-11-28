import { addPlaylistSection } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { useAddPlaylistSection } from '../use-add-playlist-section';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);

describe('apps/client/web: useAddPlaylistSection', () => {
  it('sends the title and marks the playlist stale, so the section comes back from the server', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(addPlaylistSection, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json({ id: uuid(6000) }, { status: 201 });
      })
    );
    const key = playlistQueryOptions(api, LIST).queryKey;
    const client = createQueryClient();
    client.setQueryData(key, playlistDetail(LIST, []));
    const { result } = renderWithToasts(() => useAddPlaylistSection(LIST), client);

    await result.current.mutateAsync('Night trams');

    expect(bodies).toEqual([{ title: 'Night trams' }]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });
});

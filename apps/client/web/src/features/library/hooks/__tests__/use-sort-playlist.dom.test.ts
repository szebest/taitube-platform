import { sortPlaylist } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { useSortPlaylist } from '../use-sort-playlist';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);

describe('apps/client/web: useSortPlaylist', () => {
  it('writes the sort back, says so and marks the playlist stale', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(sortPlaylist, async ({ request }) => {
        bodies.push(await request.clone().json());
        return new HttpResponse<null>(null, { status: 204 });
      })
    );
    const key = playlistQueryOptions(api, LIST).queryKey;
    const client = createQueryClient();
    client.setQueryData(key, playlistDetail(LIST, []));
    const { result, show } = renderWithToasts(() => useSortPlaylist(LIST), client);

    await result.current.mutateAsync('duration');

    expect(bodies).toEqual([{ sort: 'duration' }]);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', title: 'The playlist keeps this order now' })
    );
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });
});

import { importPlaylist } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { useImportPlaylist } from '../use-import-playlist';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);

describe('apps/client/web: useImportPlaylist', () => {
  it('sends the text in its format and marks the playlist stale', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(importPlaylist, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json({ lines: [] });
      })
    );
    const key = playlistQueryOptions(api, LIST).queryKey;
    const client = createQueryClient();
    client.setQueryData(key, playlistDetail(LIST, []));
    const { result } = renderWithToasts(() => useImportPlaylist(LIST), client);

    await result.current.mutateAsync({ format: 'urls', content: uuid(1) });

    expect(bodies).toEqual([{ format: 'urls', content: uuid(1) }]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });
});

import { removePlaylistSection } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { useRemovePlaylistSection } from '../use-remove-playlist-section';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const [KEEP, DROP] = [uuid(6000), uuid(6001)];

describe('apps/client/web: useRemovePlaylistSection', () => {
  it('drops the section from the playlist and asks the server to remove it', async () => {
    const removed: string[] = [];
    apiServer.use(
      mockEndpoint(removePlaylistSection, ({ params }) => {
        removed.push(String(params.itemId));
        return new HttpResponse<null>(null, { status: 204 });
      })
    );
    const key = playlistQueryOptions(api, LIST).queryKey;
    const client = createQueryClient();
    client.setQueryData(key, {
      ...playlistDetail(LIST, []),
      sections: [
        { id: KEEP, title: 'Keep', position: 0 },
        { id: DROP, title: 'Drop', position: 1 },
      ],
    });
    const { result } = renderWithToasts(() => useRemovePlaylistSection(LIST), client);

    await result.current.mutateAsync(DROP);

    expect(removed).toEqual([DROP]);
    expect(client.getQueryData(key)?.sections.map(({ id }) => id)).toEqual([KEEP]);
  });
});

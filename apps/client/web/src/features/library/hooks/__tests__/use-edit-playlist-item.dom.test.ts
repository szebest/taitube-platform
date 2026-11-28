import { editPlaylistItem, type PlaylistView } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { libraryVideo, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { useEditPlaylistItem } from '../use-edit-playlist-item';
import { renderWithToasts } from './toast-harness';

type PlaylistItemEdit = Parameters<ReturnType<typeof useEditPlaylistItem>['mutate']>[0];

const LIST = uuid(4100);
const ITEM = uuid(5000);
const SECTION = uuid(6000);
const KEY = playlistQueryOptions(api, LIST).queryKey;

function renderEdit(reply: () => Response) {
  const bodies: unknown[] = [];
  apiServer.use(
    mockEndpoint(editPlaylistItem, async ({ request }) => {
      bodies.push(await request.clone().json());
      return reply();
    })
  );
  const client = createQueryClient();
  client.setQueryData(KEY, {
    ...playlistDetail(LIST, [libraryVideo(1)]),
    sections: [{ id: SECTION, title: 'Old', position: 1 }],
  });
  const { result } = renderWithToasts(() => useEditPlaylistItem(LIST), client);
  return { result, client, bodies };
}

const NO_CONTENT = () => new HttpResponse<null>(null, { status: 204 });

describe('apps/client/web: useEditPlaylistItem', () => {
  it.each<{
    target: string;
    edit: PlaylistItemEdit;
    body: object;
    shown: (data: PlaylistView) => unknown;
  }>([
    {
      target: 'a video item',
      edit: { kind: 'video', itemId: ITEM, note: 'Sound off', startMs: 30_000, endMs: null },
      body: { note: 'Sound off', startMs: 30_000, endMs: null },
      shown: ({ items: [item] }) => [item?.note, item?.startMs, item?.endMs],
    },
    {
      target: 'a section',
      edit: { kind: 'section', itemId: SECTION, title: 'Night' },
      body: { title: 'Night' },
      shown: ({ sections: [section] }) => [section?.title],
    },
  ])(
    'sends the fields of $target and shows them in the playlist',
    async ({ edit, body, shown }) => {
      const { result, client, bodies } = renderEdit(NO_CONTENT);

      await result.current.mutateAsync(edit);

      const playlist = client.getQueryData(KEY);
      expect(bodies).toEqual([body]);
      expect(playlist && shown(playlist)).toEqual(Object.values(body));
    }
  );

  it('puts the note back when the edit is refused', async () => {
    const { result, client } = renderEdit(() => problemReply(ErrorCodes.FORBIDDEN));

    await expect(
      result.current.mutateAsync({
        kind: 'video',
        itemId: ITEM,
        note: 'Mine',
        startMs: null,
        endMs: null,
      })
    ).rejects.toThrow();

    expect(client.getQueryData(KEY)?.items[0]?.note).toBeNull();
  });
});

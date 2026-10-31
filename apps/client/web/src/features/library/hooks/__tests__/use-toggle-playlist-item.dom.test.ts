import { addPlaylistItem, removePlaylistItem } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import {
  ownedPlaylist,
  playlistDetail,
  uuid,
} from '#app/features/library/__tests__/library-fixtures';
import { saveTargetsQueryOptions } from '#app/features/library/api/library-queries';
import { useTogglePlaylistItem } from '../use-toggle-playlist-item';
import { renderWithToasts } from './toast-harness';

const VIDEO_ID = uuid(7);
const TRIPS = uuid(4001);
const key = saveTargetsQueryOptions(api, VIDEO_ID).queryKey;

function seeded(containsVideo: boolean, videoCount: number) {
  const client = createQueryClient();
  client.setQueryData(key, {
    items: [ownedPlaylist(1, { id: TRIPS, title: 'Road trips', containsVideo, videoCount })],
  });
  return client;
}

const stateOf = (client: ReturnType<typeof seeded>) =>
  client.getQueryData<{ items: { containsVideo: boolean; videoCount: number }[] }>(key)?.items[0];

describe('apps/client/web: useTogglePlaylistItem', () => {
  it.each([
    {
      scenario: 'saves',
      saved: true,
      from: [false, 3],
      to: [true, 4],
      title: 'Saved to Road trips',
    },
    {
      scenario: 'removes',
      saved: false,
      from: [true, 3],
      to: [false, 2],
      title: 'Removed from Road trips',
    },
  ])(
    '$scenario the video at once and says so once the server agrees',
    async ({ saved, from, to, title }) => {
      const held = heldReply(() =>
        saved
          ? HttpResponse.json(playlistDetail(TRIPS, []), { status: 201 })
          : new HttpResponse<null>(null, { status: 204 })
      );
      apiServer.use(
        mockEndpoint(addPlaylistItem, held.answer as never),
        mockEndpoint(removePlaylistItem, held.answer as never)
      );
      const client = seeded(from[0] as boolean, from[1] as number);
      const { result, show } = renderWithToasts(() => useTogglePlaylistItem(VIDEO_ID), client);

      const running = result.current.mutateAsync({ playlistId: TRIPS, title: 'Road trips', saved });
      await vi.waitFor(() =>
        expect(stateOf(client)).toMatchObject({ containsVideo: to[0], videoCount: to[1] })
      );
      held.release();
      await running;

      expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success', title }));
    }
  );

  it('never counts below zero', async () => {
    apiServer.use(
      mockEndpoint(removePlaylistItem, () => new HttpResponse<null>(null, { status: 204 }))
    );
    const client = seeded(true, 0);
    const { result } = renderWithToasts(() => useTogglePlaylistItem(VIDEO_ID), client);

    await result.current.mutateAsync({ playlistId: TRIPS, title: 'Road trips', saved: false });

    expect(stateOf(client)?.videoCount).toBe(0);
  });
});

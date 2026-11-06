import { screen, waitFor } from '@testing-library/react';
import { reorderPlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { playlistDetail } from '#app/features/library/__tests__/library-fixtures';
import {
  ITEMS,
  LIST,
  renderPlaylist,
  rowOf,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: the playlist items', () => {
  it.each([
    { action: 'Move to top', title: 'Night bus', order: [ITEMS[2], ITEMS[0], ITEMS[1]] },
    { action: 'Move to bottom', title: 'Tram ride', order: [ITEMS[1], ITEMS[2], ITEMS[0]] },
  ])('sends one reorder with the whole new order for $action', async ({ action, title, order }) => {
    const bodies: unknown[] = [];
    const { user } = await renderPlaylist({}, [
      mockEndpoint(reorderPlaylist, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json(playlistDetail(LIST, VIDEOS));
      }),
    ]);

    await user.click((await rowOf(title)).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: action }));

    await waitFor(() => expect(bodies).toEqual([{ itemIds: order }]));
  });

  it('shows an empty playlist as a message', async () => {
    await renderPlaylist({ items: [], videoCount: 0 });

    expect(await screen.findByText('Nothing in this playlist yet')).toBeInTheDocument();
  });
});

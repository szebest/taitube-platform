import { screen, waitFor } from '@testing-library/react';
import { removePlaylistItem } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { renderPlaylist, rowOf, titles } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: useRemovePlaylistItem', () => {
  it('drops the video from the list at once and asks the server to remove it', async () => {
    const removed: string[] = [];
    const { user } = await renderPlaylist({}, [
      mockEndpoint(removePlaylistItem, ({ params }) => {
        removed.push(String(params.videoId));
        return new HttpResponse<null>(null, { status: 204 });
      }),
    ]);

    await user.click((await rowOf('Old film')).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from playlist' }));

    await waitFor(() => expect(titles()).toEqual(['Tram ride', 'Night bus']));
    expect(removed).toEqual([uuid(2)]);
  });

  it('puts the video back when the server refuses', async () => {
    const { user } = await renderPlaylist({}, [
      mockEndpoint(removePlaylistItem, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await user.click((await rowOf('Old film')).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from playlist' }));

    await waitFor(() => expect(titles()).toEqual(['Tram ride', 'Old film', 'Night bus']));
  });
});

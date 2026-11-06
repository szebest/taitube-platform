import { screen, waitFor, within } from '@testing-library/react';
import { deletePlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: the delete playlist dialog', () => {
  it('deletes after asking, and leaves for the list of playlists', async () => {
    let deleted = false;
    const { user, router } = await renderPlaylist({}, [
      mockEndpoint(deletePlaylist, () => {
        deleted = true;
        return new HttpResponse<null>(null, { status: 204 });
      }),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Delete playlist' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this playlist?' });
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Delete playlist' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/feed/playlists'));
    expect(deleted).toBe(true);
  });

  it('keeps the playlist when the viewer cancels', async () => {
    const { user, router } = await renderPlaylist();

    await user.click(await screen.findByRole('button', { name: 'Delete playlist' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this playlist?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/playlist');
  });
});

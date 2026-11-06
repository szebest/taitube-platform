import { screen, waitFor, within } from '@testing-library/react';
import { deletePlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: useDeletePlaylist', () => {
  it('stays on the playlist and says so when the delete is refused', async () => {
    const { user, router } = await renderPlaylist({}, [
      mockEndpoint(deletePlaylist, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Delete playlist' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this playlist?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete playlist' }));

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/playlist'));
  });
});

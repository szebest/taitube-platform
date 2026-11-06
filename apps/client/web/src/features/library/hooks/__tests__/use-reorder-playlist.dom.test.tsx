import { screen, waitFor } from '@testing-library/react';
import { reorderPlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderPlaylist, rowOf, titles } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: useReorderPlaylist', () => {
  it('puts the old order back and says so when the reorder is refused', async () => {
    const { user } = await renderPlaylist({}, [
      mockEndpoint(reorderPlaylist, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await user.click((await rowOf('Night bus')).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to top' }));

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
    await waitFor(() => expect(titles()).toEqual(['Tram ride', 'Old film', 'Night bus']));
  });
});

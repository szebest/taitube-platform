import { screen, within } from '@testing-library/react';
import { transferPlaylistItems } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { ownedPlaylist, playlistDetail } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { ITEMS, LIST, VIDEOS } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistTransferDialog } from '../playlist-transfer-dialog.lazy';

const TRIPS = ownedPlaylist(1, { title: 'Trips' });
const SMART = ownedPlaylist(2, { title: 'Fresh', isSmart: true });

/** The playlist page with the viewer's other playlists to pick from, the transfer answered with one of each outcome. */
const renderTransfer = () => {
  const bodies: unknown[] = [];
  const rendered = renderLibrary(`/playlist?list=${LIST}`, {
    playlists: [TRIPS, SMART],
    details: [playlistDetail(LIST, VIDEOS)],
    handlers: [
      mockEndpoint(transferPlaylistItems, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json({
          playlistId: TRIPS.id,
          results: [
            { itemId: ITEMS[0] ?? '', ok: true, duplicate: false },
            { itemId: ITEMS[1] ?? '', ok: true, duplicate: true },
            { itemId: ITEMS[2] ?? '', ok: false, duplicate: false, code: ErrorCodes.FORBIDDEN },
          ],
        });
      }),
    ],
  });
  return { rendered, bodies };
};

describe('apps/client/web: moving and copying selected videos', () => {
  beforeAll(() => LazyPlaylistTransferDialog.preload());

  it('moves the selection and reports what landed, what was there already and what was refused', async () => {
    const { rendered, bodies } = renderTransfer();
    const { user } = await rendered;

    await user.click(await screen.findByRole('button', { name: 'Select' }));
    for (const title of ['Tram ride', 'Old film', 'Night bus']) {
      await user.click(screen.getByRole('checkbox', { name: `Select ${title}` }));
    }
    await user.click(screen.getByRole('button', { name: 'Move to' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Move to a playlist' }));
    expect(await dialog.findByRole('radio', { name: /Fresh/ })).toBeDisabled();
    expect(dialog.getByText('Fills itself from rules')).toBeInTheDocument();
    await user.click(dialog.getByRole('radio', { name: 'Trips' }));
    await user.click(dialog.getByRole('button', { name: 'Move' }));

    expect(await dialog.findByText('Moved: 1')).toBeInTheDocument();
    expect(dialog.getByText('Skipped as already there: 1')).toBeInTheDocument();
    expect(dialog.getByText('Refused: 1')).toBeInTheDocument();
    expect(dialog.getByText('Night bus: you may not move it')).toBeInTheDocument();
    expect(bodies).toEqual([{ itemIds: ITEMS, to: TRIPS.id, mode: 'move' }]);
    expect(screen.queryByRole('toolbar', { name: 'Selected videos' })).toBeNull();
  });

  it('asks for a selection when it opens from a link with none', async () => {
    await renderLibrary(`/playlist?list=${LIST}&modal=playlist-transfer&transfer=copy`, {
      details: [playlistDetail(LIST, VIDEOS)],
    });

    const dialog = within(await screen.findByRole('dialog', { name: 'Copy to a playlist' }));
    expect(
      dialog.getByText('Select the videos first, then pick where they go.')
    ).toBeInTheDocument();
  });
});

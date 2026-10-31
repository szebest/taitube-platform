import { screen, within } from '@testing-library/react';
import { createPlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { playlistDetail, uuid } from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';

const URL = '/feed/history?modal=new-playlist';

async function openDialog() {
  const rendered = await renderLibrary(URL, {
    handlers: [
      mockEndpoint(createPlaylist, () =>
        HttpResponse.json(playlistDetail(uuid(4900), [], { title: 'Trips' }), { status: 201 })
      ),
    ],
  });
  const dialog = await screen.findByRole('dialog', { name: 'New playlist' });
  return { ...rendered, dialog };
}

describe('apps/client/web: NewPlaylistDialog', () => {
  it('creates the playlist and closes', async () => {
    const { user, dialog, router } = await openDialog();

    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Trips');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Created Trips')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.search).not.toHaveProperty('modal');
  });

  it('closes on Cancel', async () => {
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

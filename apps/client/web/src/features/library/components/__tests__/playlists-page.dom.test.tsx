import { screen, within } from '@testing-library/react';

import {
  ownedPlaylist,
  uuid,
  WATCH_LATER_ID,
} from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';

describe('apps/client/web: /feed/playlists', () => {
  it('lists every playlist as a card linking to its page, Watch later first', async () => {
    await renderLibrary('/feed/playlists', {
      playlists: [
        ownedPlaylist(0, { id: WATCH_LATER_ID, title: 'Watch later', isSystem: true }),
        ownedPlaylist(1, { title: 'Road trips', videoCount: 24 }),
      ],
    });

    const list = await screen.findByRole('list', { name: 'Your playlists' });

    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Watch later', 'Road trips']);
    expect(within(list).getByRole('link', { name: 'Road trips' })).toHaveAttribute(
      'href',
      `/playlist?list=${uuid(4001)}`
    );
    expect(within(list).getByText('24 videos')).toBeInTheDocument();
  });

  it('shows one line and New playlist, which opens the dialog, when there are none', async () => {
    const { user } = await renderLibrary('/feed/playlists', { playlists: [] });

    expect(await screen.findByText('Playlists you make show up here')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'New playlist' })[0] as HTMLElement);

    expect(await screen.findByRole('dialog', { name: 'New playlist' })).toBeInTheDocument();
  });
});

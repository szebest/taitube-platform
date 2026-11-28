import { screen, within } from '@testing-library/react';
import { libraryVideo, ownedPlaylist, playlistDetail } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { WATCH_LATER } from '#app/features/library/__tests__/you-cache';

const EARLY = ownedPlaylist(1, { title: 'Weekend', pinnedAt: '2026-03-01T10:00:00.000Z' });
const LATE = ownedPlaylist(2, { title: 'Cooking', pinnedAt: '2026-03-09T10:00:00.000Z' });

describe('apps/client/web: the pinned shelves', () => {
  it('gives each pinned playlist a shelf after Watch later, the oldest pin first, with its videos', async () => {
    await renderLibrary('/feed/you', {
      playlists: [WATCH_LATER, LATE, ownedPlaylist(3, { title: 'Unpinned' }), EARLY],
      details: [
        playlistDetail(EARLY.id, [libraryVideo(1, 'Tram ride')], { title: 'Weekend' }),
        playlistDetail(LATE.id, [], { title: 'Cooking' }),
      ],
    });

    const weekend = within(await screen.findByRole('region', { name: 'Weekend' }));
    expect(await weekend.findByRole('link', { name: 'Tram ride' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Cooking' })).getByText(
        'Nothing in this playlist yet'
      )
    ).toBeInTheDocument();
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map(({ textContent }) => textContent);
    const from = headings.indexOf('Watch later');
    expect(headings.slice(from, from + 4)).toEqual([
      'Watch later',
      'Weekend',
      'Cooking',
      'Playlists',
    ]);
  });
});

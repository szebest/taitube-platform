import { screen } from '@testing-library/react';
import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: the playlist hero summary', () => {
  it('marks a smart playlist and sums up its rules', async () => {
    await renderPlaylist({
      rules: {
        match: 'any',
        conditions: [{ field: 'unwatched' }, { field: 'newer_than', days: 7 }],
        sort: 'newest',
        limit: 40,
      },
    });

    expect(await screen.findByText('Smart')).toBeInTheDocument();
    expect(screen.getByText('Any of 2 conditions · up to 40 videos')).toBeInTheDocument();
  });
});

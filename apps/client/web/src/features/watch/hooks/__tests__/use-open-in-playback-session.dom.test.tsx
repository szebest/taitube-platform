import { screen } from '@testing-library/react';

import { LIST, QUEUED, renderPlaylistWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: useOpenInPlaybackSession', () => {
  it('shows the playlist the page was opened from, with the video on the stage current', async () => {
    await renderPlaylistWatch();

    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `Queued ${QUEUED[0]}` })).toHaveAttribute(
      'href',
      `/watch/${QUEUED[0]}?list=${LIST}&index=1`
    );
  });
});

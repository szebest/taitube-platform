import { screen } from '@testing-library/react';

import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';
import { shortSummary } from '#app/features/shorts/__tests__/short-fixtures';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

describe('apps/client/web: ShortsFeedPlayer', () => {
  it('plays the Short of its playback URL in the vertical layout', async () => {
    await renderShorts({ shorts: [shortSummary(1)] });

    const player = await screen.findByTestId('player');
    expect(player).toHaveAttribute('data-src', 'http://localhost:9000/hls/1/master.m3u8');
    expect(player).toHaveAttribute('data-layout', 'vertical');
  });

  it('shows the poster alone for a Short that has no playback URL yet', async () => {
    await renderShorts({ shorts: [shortSummary(1, { playbackUrl: undefined })] });

    expect(screen.queryByTestId('player')).not.toBeInTheDocument();
    expect(document.querySelector('img[src="http://localhost:9000/posters/1.jpg"]')).not.toBeNull();
  });
});

import { screen, within } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';
import { PLAYHEAD } from '#app/features/watch/__tests__/stub-player';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: now playing bar', () => {
  it('keeps the same player element playing in the bar once the viewer leaves the watch page', async () => {
    const { router } = await renderWatch();
    const player = screen.getByTestId('player');
    expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();

    await router.navigate({ to: '/' });

    const bar = await screen.findByRole('region', { name: 'Now playing' });
    expect(within(bar).getByTestId('player')).toBe(player);
    expect(within(bar).getAllByText('Launch day').length).toBeGreaterThan(0);
  });

  it('expands back to the watch page at the current time', async () => {
    const { user, router } = await renderWatch();
    await router.navigate({ to: '/' });
    const bar = await screen.findByRole('region', { name: 'Now playing' });

    await user.click(within(bar).getByRole('link', { name: 'Back to the video' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${VIDEO_ID}`));
    expect(router.state.location.searchStr).toBe(`?t=${PLAYHEAD}`);
    expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();
  });

  it('stops playback and takes the bar away when it is closed', async () => {
    const { user, router } = await renderWatch();
    await router.navigate({ to: '/' });
    const bar = await screen.findByRole('region', { name: 'Now playing' });

    await user.click(within(bar).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('player')).not.toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import { getClip } from '@vp/api-contracts';
import { CLIP_ID, clip, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

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

  it('never leaves the player out of the document while it moves from the bar to the stage', async () => {
    const { user, router } = await renderWatch();
    await router.navigate({ to: '/' });
    const bar = await screen.findByRole('region', { name: 'Now playing' });
    const player = within(bar).getByTestId('player');

    await user.click(within(bar).getByRole('link', { name: 'Back to the video' }));

    expect(player.isConnected).toBe(true);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${VIDEO_ID}`));
    expect(screen.getByTestId('player')).toBe(player);
    expect(player.isConnected).toBe(true);
  });

  it('pauses the session player when a page with a player of its own opens', async () => {
    const { user, router } = await renderWatch({
      handlers: [mockEndpoint(getClip, () => HttpResponse.json(clip()))],
    });
    await user.click(screen.getByRole('button', { name: 'Start playing' }));
    expect(screen.getByTestId('player')).toHaveAttribute('data-playing', 'true');

    await router.navigate({ to: '/clip/$clipId', params: { clipId: CLIP_ID } });

    const bar = await screen.findByRole('region', { name: 'Now playing' });
    expect(within(bar).getByTestId('player')).toHaveAttribute('data-playing', 'false');
  });
});

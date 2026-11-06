import { screen, within } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: the player slot', () => {
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
});

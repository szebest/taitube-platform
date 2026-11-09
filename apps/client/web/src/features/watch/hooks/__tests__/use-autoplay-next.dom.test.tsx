import { screen } from '@testing-library/react';
import { LIST, QUEUED, renderPlaylistWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: useAutoplayNext', () => {
  it('opens the next video of the playlist once the video ends, replacing the history entry', async () => {
    const { user, router } = await renderPlaylistWatch();
    await screen.findByText('1 / 3');
    const entries = router.history.length;

    await user.click(screen.getByRole('button', { name: 'End video' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${QUEUED[0]}`));
    expect(router.state.location.searchStr).toBe(`?list=${LIST}&index=1`);
    expect(router.history.length).toBe(entries);
  });
});

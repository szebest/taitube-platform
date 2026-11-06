import { screen } from '@testing-library/react';
import { QUEUED, renderPlaylistWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: useQueueNavigation', () => {
  it('opens a queue item the viewer picks as a new history entry', async () => {
    const { user, router } = await renderPlaylistWatch();
    await screen.findByText('1 / 3');
    const entries = router.history.length;

    screen.getByRole('listitem', { name: `Queued ${QUEUED[0]}` }).focus();
    await user.keyboard('{Enter}');

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${QUEUED[0]}`));
    expect(router.history.length).toBe(entries + 1);
  });
});

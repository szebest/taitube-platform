import { screen } from '@testing-library/react';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';
import { THREAD_ID } from '#app/features/watch/__tests__/thread-fixtures';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: useThreadSearch', () => {
  it('writes the chosen tab into the URL without a new history entry', async () => {
    const { user, router } = await renderThreads({ search: '?t=30' });
    const entries = router.history.length;

    await user.click(screen.getByRole('tab', { name: 'Threads' }));

    await vi.waitFor(() =>
      expect(router.state.location.search).toMatchObject({ t: '30', tab: 'threads' })
    );
    expect(router.history.length).toBe(entries);
  });

  it('writes an opened thread into the URL on the Threads tab and drops it on close', async () => {
    const { user, router } = await renderThreads({ search: '?tab=threads' });

    await user.click(await screen.findByRole('button', { name: /The twist at the tram/ }));

    await vi.waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tab: 'threads', thread: THREAD_ID })
    );

    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await vi.waitFor(() => expect(router.state.location.search.thread).toBeUndefined());
    expect(router.state.location.search).toMatchObject({ tab: 'threads' });
  });
});

import { screen } from '@testing-library/react';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';
import { THREAD_ID } from '#app/features/watch/__tests__/thread-fixtures';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: SignInPrompt', () => {
  it('stands in for the reply box of a guest and opens the sign-in prompt', async () => {
    const { user, router } = await renderThreads({ search: '?tab=threads' });

    await user.click(await screen.findByRole('button', { name: /The twist at the tram/ }));
    expect(await screen.findByText('Sign in to join the discussion')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('dialog', { name: 'Sign in to comment' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ thread: THREAD_ID });
  });
});

import { screen, within } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const hosts = () => document.querySelectorAll('[data-slot=playback-host]');

describe('apps/client/web: the player slot', () => {
  it('never moves the player: one host, one player, in the document throughout the way from the page to the bar and back', async () => {
    const { user, router } = await renderWatch();
    const player = screen.getByTestId('player');
    const host = player.closest('[data-slot=playback-host]');
    expect(host).toHaveAttribute('data-state', 'docked');

    await router.navigate({ to: '/' });
    const bar = await screen.findByRole('region', { name: 'Now playing' });
    await vi.waitFor(() => expect(host).toHaveAttribute('data-state', 'mini'));
    expect(player.isConnected).toBe(true);
    expect(player.parentElement?.closest('[data-slot=playback-host]')).toBe(host);

    await user.click(within(bar).getByRole('link', { name: 'Back to the video' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${VIDEO_ID}`));
    await vi.waitFor(() => expect(host).toHaveAttribute('data-state', 'docked'));
    expect(screen.getByTestId('player')).toBe(player);
    expect(player.isConnected).toBe(true);
    expect(hosts()).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid=player]')).toHaveLength(1);
  });

  it('registers a slot while the page holds it, and gives it back when the page goes', async () => {
    const { router } = await renderWatch();
    const host = screen.getByTestId('player').closest('[data-slot=playback-host]');

    await router.navigate({ to: '/feed/trending' });

    await vi.waitFor(() => expect(host).toHaveAttribute('data-state', 'mini'));
  });
});

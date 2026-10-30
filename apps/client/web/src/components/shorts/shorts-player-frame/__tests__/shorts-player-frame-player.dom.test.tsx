import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { ShortsPlayerFrameRoot } from '../shorts-player-frame';
import { ShortsPlayerFramePlayer } from '../shorts-player-frame-player';
import type { ShortsFrameState } from '../types';

function renderPlayer(state: ShortsFrameState, paused = false, muted = false) {
  const playback = { paused, muted, onTogglePlay: vi.fn(), onToggleMute: vi.fn() };
  render(
    <AppProviders>
      <ShortsPlayerFrameRoot state={state} playback={playback}>
        <ShortsPlayerFramePlayer>
          <p>Media</p>
        </ShortsPlayerFramePlayer>
      </ShortsPlayerFrameRoot>
    </AppProviders>
  );
  return { playback, user: userEvent.setup() };
}

describe('apps/client/web: ShortsPlayerFramePlayer', () => {
  it.each([
    { state: 'ready', surface: true },
    { state: 'ended', surface: true },
    { state: 'loading', surface: false },
    { state: 'error', surface: false },
  ] as const)('offers the press surface in $state: $surface', ({ state, surface }) => {
    renderPlayer(state);

    expect(screen.queryByRole('button', { name: 'Pause' }) !== null).toBe(surface);
  });

  it.each([
    { paused: false, name: 'Pause' },
    { paused: true, name: 'Play' },
  ])('toggles playback from the surface named $name', async ({ paused, name }) => {
    const { user, playback } = renderPlayer('ready', paused);

    await user.click(screen.getByRole('button', { name }));

    expect(playback.onTogglePlay).toHaveBeenCalledOnce();
  });

  it('keeps the spinner out of the first 400 ms of loading', () => {
    vi.useFakeTimers();
    renderPlayer('loading');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    vi.useRealTimers();
  });

  it('shows the media in the player and the caught up notice when ended', () => {
    renderPlayer('ended');

    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You are all caught up');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { NowPlayingBarRoot } from '../now-playing-bar';
import { NowPlayingBarProgress } from '../now-playing-bar-progress';
import type { NowPlayingBarStatus } from '../types';

function renderProgress(progress = 0.5, status: NowPlayingBarStatus = 'ready') {
  const onSeek = vi.fn();
  render(
    <AppProviders>
      <NowPlayingBarRoot
        playing
        progress={progress}
        status={status}
        onPlayPause={vi.fn()}
        onSeek={onSeek}
      >
        <NowPlayingBarProgress valueText="9 minutes of 18 minutes" step={0.1} />
      </NowPlayingBarRoot>
    </AppProviders>
  );
  return { onSeek, user: userEvent.setup(), slider: () => screen.queryByRole('slider') };
}

describe('apps/client/web: NowPlayingBarProgress', () => {
  it.each([
    { key: '{ArrowRight}', fraction: 0.6 },
    { key: '{ArrowDown}', fraction: 0.4 },
    { key: '{Home}', fraction: 0 },
    { key: '{End}', fraction: 1 },
  ])('seeks to $fraction on $key', async ({ key, fraction }) => {
    const { onSeek, user, slider } = renderProgress();

    slider()?.focus();
    await user.keyboard(key);

    expect(onSeek).toHaveBeenCalledWith(fraction);
  });

  it.each([
    { progress: -1, now: '0' },
    { progress: 0.25, now: '25' },
    { progress: 2, now: '100' },
  ])('clamps a progress of $progress to $now', ({ progress, now }) => {
    const { slider } = renderProgress(progress);

    expect(slider()).toHaveAttribute('aria-valuenow', now);
  });

  it('seeks to the pointer position as a fraction of the bar', () => {
    const { onSeek, slider } = renderProgress();
    const bar = slider() as HTMLElement;
    bar.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;
    bar.setPointerCapture = vi.fn();

    fireEvent.pointerDown(bar, { clientX: 150, pointerId: 1 });

    expect(onSeek).toHaveBeenCalledWith(0.25);
  });

  it('is absent while live', () => {
    const { slider } = renderProgress(0.5, 'live');

    expect(slider()).toBeNull();
  });
});

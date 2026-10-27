import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Icon } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { ShortsPlayerFrame, ShortsPlayerFrameSkeleton } from '..';
import type { ShortsPlayerFrameRootProps } from '../shorts-player-frame';

function renderFrame(props: Partial<ShortsPlayerFrameRootProps> = {}, liked = false) {
  const playback = { paused: false, muted: false, onTogglePlay: vi.fn(), onToggleMute: vi.fn() };
  const onPrevious = vi.fn();
  const onNext = vi.fn();
  const onLike = vi.fn();
  const onRetry = vi.fn();
  render(
    <AppProviders>
      <ShortsPlayerFrame.Root
        playback={playback}
        onPrevious={onPrevious}
        onNext={onNext}
        {...props}
      >
        <ShortsPlayerFrame.Player>
          <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" />
          <ShortsPlayerFrame.Error onRetry={onRetry}>
            This Short did not load.
          </ShortsPlayerFrame.Error>
          <ShortsPlayerFrame.Caption>The 28 tram at dusk</ShortsPlayerFrame.Caption>
          <ShortsPlayerFrame.Progress value={0.4} />
        </ShortsPlayerFrame.Player>
        <ShortsPlayerFrame.Actions>
          <ShortsPlayerFrame.Action
            icon={<Icon name="like" />}
            count="24K"
            pressed={liked}
            onSelect={onLike}
          >
            Like
          </ShortsPlayerFrame.Action>
        </ShortsPlayerFrame.Actions>
      </ShortsPlayerFrame.Root>
    </AppProviders>
  );
  return { user: userEvent.setup(), playback, onPrevious, onNext, onLike, onRetry };
}

describe('apps/client/web: ShortsPlayerFrame', () => {
  it('is a region named for the Shorts player', () => {
    renderFrame();

    expect(screen.getByRole('region', { name: 'Shorts player' })).toBeInTheDocument();
  });

  it.each([
    { key: '{ArrowDown}', moves: 'onNext' },
    { key: 'j', moves: 'onNext' },
    { key: '{ArrowUp}', moves: 'onPrevious' },
    { key: 'k', moves: 'onPrevious' },
  ] as const)('moves with $key', async ({ key, moves }) => {
    const rendered = renderFrame();
    screen.getByRole('button', { name: 'Pause' }).focus();

    await rendered.user.keyboard(key);

    expect(rendered[moves]).toHaveBeenCalledOnce();
  });

  it.each([
    { key: 'm', focus: 'Like 24K', toggles: 'onToggleMute' },
    { key: ' ', focus: 'Pause', toggles: 'onTogglePlay' },
  ] as const)('reaches playback once with "$key" from $focus', async ({ key, focus, toggles }) => {
    const { user, playback } = renderFrame();
    screen.getByRole('button', { name: focus }).focus();

    await user.keyboard(key);

    expect(playback[toggles]).toHaveBeenCalledOnce();
  });

  it.each([
    { label: 'Previous Short', moves: 'onPrevious' },
    { label: 'Next Short', moves: 'onNext' },
  ] as const)('moves with the $label button', async ({ label, moves }) => {
    const rendered = renderFrame();

    await rendered.user.click(screen.getByRole('button', { name: label }));

    expect(rendered[moves]).toHaveBeenCalledOnce();
  });

  it('disables next on the last Short and says the viewer is caught up', async () => {
    const { user, onNext } = renderFrame({ state: 'ended' });

    await user.keyboard('j');

    expect(screen.getByRole('button', { name: 'Next Short' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('You are all caught up');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows previous and next only for the callbacks it has', () => {
    renderFrame({ onPrevious: undefined, onNext: undefined });

    expect(screen.queryByRole('button', { name: 'Next Short' })).not.toBeInTheDocument();
  });

  it('plays from the paused glyph and unmutes from the muted marker', async () => {
    const playback = { paused: true, muted: true, onTogglePlay: vi.fn(), onToggleMute: vi.fn() };
    const { user } = renderFrame({ playback });

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await user.click(screen.getByRole('button', { name: 'Unmute' }));

    expect(playback.onTogglePlay).toHaveBeenCalledOnce();
    expect(playback.onToggleMute).toHaveBeenCalledOnce();
  });

  it.each([false, true])('names an action with its count, pressed %s', async (liked) => {
    const { user, onLike } = renderFrame({}, liked);
    const like = screen.getByRole('button', { name: 'Like 24K' });

    await user.click(like);

    expect(like).toHaveAttribute('aria-pressed', String(liked));
    expect(onLike).toHaveBeenCalledOnce();
  });

  it('shows the failure with a retry only in the error state', async () => {
    const { user, onRetry } = renderFrame({ state: 'error' });

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('alert')).toHaveTextContent('This Short did not load.');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('waits 400 ms before it shows the loading spinner', () => {
    vi.useFakeTimers();
    renderFrame({ state: 'loading' });

    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    vi.useRealTimers();
  });

  it('names a part used outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ShortsPlayerFrame.Actions />)).toThrow(
      'ShortsPlayerFrame.Actions must be inside ShortsPlayerFrame.Root'
    );
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderFrame({
      playback: { paused: true, muted: true, onTogglePlay: vi.fn(), onToggleMute: vi.fn() },
    });
    render(<ShortsPlayerFrameSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});

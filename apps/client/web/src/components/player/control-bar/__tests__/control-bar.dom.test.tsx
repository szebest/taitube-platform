import { act, fireEvent, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { renderBar } from './render-bar';

afterEach(() => {
  vi.useRealTimers();
});

describe('apps/client/web: the player control bar', () => {
  it.each([
    { paused: true, label: 'Play', method: 'play' },
    { paused: false, label: 'Pause', method: 'pause' },
  ] as const)('offers $label and calls $method on the video', async ({ paused, label, method }) => {
    const call = vi.spyOn(HTMLMediaElement.prototype, method).mockResolvedValue();
    const { user } = renderBar({ paused });

    await user.click(await screen.findByRole('button', { name: label }));

    expect(call).toHaveBeenCalledOnce();
  });

  it('shows where the playhead is out of the whole video', async () => {
    const { bar } = renderBar({ currentTime: 65, duration: 600 });

    await vi.waitFor(() => expect(bar).toHaveTextContent('01:05 / 10:00'));
    expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuetext', '01:05');
    expect(await axeViolations()).toEqual([]);
  });

  it.each([
    { title: 'Launch day', scrim: 'Launch day' },
    { title: undefined, scrim: null },
  ])('draws the bar on the media role, with a title scrim for $title', ({ title, scrim }) => {
    const { bar, container } = renderBar({ title });
    const text = container.querySelector('[data-media-controls][aria-hidden] p')?.textContent;

    expect(bar).toHaveAttribute('data-media-controls');
    expect(text ?? null).toBe(scrim);
  });

  it('sizes the seek track from the playhead and the buffered range', async () => {
    renderBar({ currentTime: 150, duration: 600 });
    const seekBar = screen.getByRole('slider', { name: 'Seek' });

    await vi.waitFor(() => expect(seekBar.style.getPropertyValue('--played')).toBe('25%'));
    expect(seekBar.style.getPropertyValue('--buffered')).toBe('0%');
  });

  it('shows only the clip: its own clock and seek bar, seeking inside it', async () => {
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    const { bar } = renderBar({
      currentTime: 75,
      duration: 600,
      range: { startMs: 60_000, endMs: 90_000 },
    });
    const seekBar = screen.getByRole('slider', { name: 'Seek' });

    await vi.waitFor(() => expect(bar).toHaveTextContent('00:15 / 00:30'));
    expect(seekBar).toHaveAttribute('max', '30');

    fireEvent.change(seekBar, { target: { value: '10' } });

    expect(seek).toHaveBeenCalledWith(70);
  });

  it('seeks to the time the seek bar moves to', async () => {
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    renderBar({ duration: 600 });
    const seekBar = screen.getByRole('slider', { name: 'Seek' });
    await vi.waitFor(() => expect(seekBar).toHaveAttribute('max', '600'));

    fireEvent.change(seekBar, { target: { value: '30' } });

    expect(seek).toHaveBeenCalledWith(30);
  });

  it.each([
    { from: 'muted', startMuted: true, shown: '0', position: '0.5', volume: 0.25, muted: false },
    { from: 'muted', startMuted: true, shown: '0', position: '1', volume: 1, muted: false },
    { from: 'full volume', startMuted: false, shown: '1', position: '0', volume: 0, muted: true },
  ])(
    'slides a video at $from to $volume, muted $muted, with the slider at $position',
    async ({ startMuted, shown, position, volume, muted }) => {
      const { video } = renderBar();
      const slider = screen.getByRole('slider', { name: 'Volume' });
      video.muted = startMuted;
      await vi.waitFor(() => expect(slider).toHaveValue(shown));

      fireEvent.change(slider, { target: { value: position } });

      expect(video.volume).toBeCloseTo(volume);
      expect(video.muted).toBe(muted);
    }
  );

  it.each([
    { volume: 0.25, muted: false, position: '0.5' },
    { volume: 0.64, muted: false, position: '0.8' },
    { volume: 1, muted: true, position: '0' },
  ])(
    'puts the volume slider at $position for $volume, muted $muted',
    async ({ volume, muted, position }) => {
      const { video } = renderBar();

      video.volume = volume;
      video.muted = muted;

      await vi.waitFor(() =>
        expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue(position)
      );
    }
  );

  it.each([
    { muted: false, label: 'Mute' },
    { muted: true, label: 'Unmute' },
  ])('offers $label and flips muted', async ({ muted, label }) => {
    const { user, video } = renderBar();
    video.muted = muted;

    await user.click(await screen.findByRole('button', { name: label }));

    expect(video.muted).toBe(!muted);
  });

  it('restores the volume from before the slider hit zero when Unmute is clicked', async () => {
    const { user, video } = renderBar();
    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.change(slider, { target: { value: '0.5' } });
    fireEvent.change(slider, { target: { value: '0' } });

    await user.click(await screen.findByRole('button', { name: 'Unmute' }));

    expect(video.volume).toBeCloseTo(0.25);
    expect(video.muted).toBe(false);
    expect(await screen.findByRole('button', { name: 'Mute' })).toBeInTheDocument();
    await vi.waitFor(() => expect(slider).toHaveValue('0.5'));
  });

  it('offers no fullscreen where the browser has none', () => {
    renderBar({ fullscreen: 'unsupported' });

    expect(screen.queryByRole('button', { name: /full screen/i })).not.toBeInTheDocument();
  });

  it.each([
    { fullscreen: 'inline', label: 'Full screen', call: 'requestFullscreen' },
    { fullscreen: 'fullscreen', label: 'Exit full screen', call: 'exitFullscreen' },
  ] as const)('offers $label and calls $call', async ({ fullscreen, label, call }) => {
    const { user, fullscreenCalls } = renderBar({ fullscreen });

    await user.click(await screen.findByRole('button', { name: label }));

    expect(fullscreenCalls[call]).toHaveBeenCalledOnce();
  });

  it.each([
    { paused: false, label: 'Pause', visible: false },
    { paused: true, label: 'Play', visible: true },
  ])(
    'shows the controls $visible once the viewer idles with paused $paused',
    async ({ paused, label, visible }) => {
      const { player, bar } = renderBar({ paused });
      await screen.findByRole('button', { name: label });

      vi.useFakeTimers();
      fireEvent.pointerMove(player);
      await act(() => vi.advanceTimersByTimeAsync(5_000));

      expect(bar.hasAttribute('data-visible')).toBe(visible);
    }
  );

  it('offers theater mode only where a channel carries it, and flips it', async () => {
    const { user } = renderBar({ channel: true });

    await user.click(await screen.findByRole('button', { name: 'Theater mode' }));

    expect(screen.getByTestId('theater')).toHaveTextContent('true');
    expect(screen.getByRole('button', { name: 'Exit theater mode' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('has no theater button when the player stands alone', async () => {
    renderBar();
    await screen.findByRole('button', { name: 'Play' });

    expect(screen.queryByRole('button', { name: /theater/i })).not.toBeInTheDocument();
  });

  it('shows a live stream the live badge, which goes back to the live edge, in place of the seek bar and the clock', async () => {
    renderBar({ live: true, duration: Number.POSITIVE_INFINITY });

    const badge = await screen.findByRole('button', { name: 'Go to live' });

    expect(badge).toHaveTextContent('Live');
    expect(screen.queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { axeViolations } from '@vp/web-testing/dom';
import { Fragment } from 'react';
import { VideoJsEngine } from '#app/features/player/engine/video-js-engine';
import { PlayerChannelProvider, usePlayerTheater } from '#app/features/player/player-channel';
import { ControlBar } from '../control-bar';

type Fullscreen = 'unsupported' | 'inline' | 'fullscreen';

interface Playhead {
  paused: boolean;
  currentTime: number;
  duration: number;
  fullscreen: Fullscreen;
}

afterEach(() => {
  vi.useRealTimers();
});

function stubFullscreen(fullscreen: Fullscreen) {
  const requestFullscreen = vi.fn();
  const exitFullscreen = vi.fn();
  const stubs = [
    { on: document, name: 'fullscreenEnabled', get: () => fullscreen !== 'unsupported' },
    {
      on: document,
      name: 'fullscreenElement',
      get: () =>
        fullscreen === 'fullscreen' ? screen.getByRole('group', { name: 'Media player' }) : null,
    },
    { on: document, name: 'exitFullscreen', get: () => exitFullscreen },
    { on: HTMLElement.prototype, name: 'requestFullscreen', get: () => requestFullscreen },
  ];
  for (const { on, name, get } of stubs) {
    Object.defineProperty(on, name, { configurable: true, get });
    onTestFinished(() => {
      Reflect.deleteProperty(on, name);
    });
  }
  return { requestFullscreen, exitFullscreen };
}

function TheaterProbe() {
  return <output data-testid="theater">{String(usePlayerTheater())}</output>;
}

function renderBar({
  paused = true,
  currentTime = 0,
  duration = 600,
  fullscreen = 'unsupported',
  channel = false,
}: Partial<Playhead> & { channel?: boolean } = {}) {
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(paused);
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'get').mockReturnValue(currentTime);
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(duration);
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(
    HTMLMediaElement.HAVE_ENOUGH_DATA
  );
  const fullscreenCalls = stubFullscreen(fullscreen);
  const user = userEvent.setup();
  const Channel = channel ? PlayerChannelProvider : Fragment;
  const rendered = render(
    <IntlProvider locale="en" timeZone="UTC">
      <Channel>
        <VideoJsEngine
          playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
          posterUrl="http://localhost:9000/posters/p.jpg"
          title="Launch day"
        >
          <ControlBar />
        </VideoJsEngine>
        <TheaterProbe />
      </Channel>
    </IntlProvider>
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  const player = screen.getByRole('group', { name: 'Media player' });
  const bar = screen.getByRole('group', { name: 'Player controls' });
  return { ...rendered, user, video, player, bar, fullscreenCalls };
}

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
});

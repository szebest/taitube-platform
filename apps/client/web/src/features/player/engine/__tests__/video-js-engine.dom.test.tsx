import { act, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Events } from 'hls.js';
import { attachedHls, parseMaster } from '#app/features/player/__tests__/offline-hls';
import { usePlayerCommands, VideoJsEngine, type VideoJsEngineProps } from '../video-js-engine';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/features/player/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const POSTER = 'http://localhost:9000/posters/p.jpg';

function PickRendition() {
  const { selectVideoRendition } = usePlayerCommands();

  return (
    <button type="button" onClick={() => selectVideoRendition('0')}>
      Pick 360p
    </button>
  );
}

function renderEngine(props: Partial<VideoJsEngineProps> = {}) {
  const user = userEvent.setup();
  const rendered = render(
    <VideoJsEngine
      playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
      posterUrl={POSTER}
      title="Launch day"
      {...props}
    >
      <PickRendition />
    </VideoJsEngine>
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  return { ...rendered, user, video };
}

function playhead(video: HTMLVideoElement, currentTime: number, duration: number) {
  Object.defineProperty(video, 'currentTime', { configurable: true, value: currentTime });
  Object.defineProperty(video, 'duration', { configurable: true, value: duration });
}

describe('apps/client/web: the Video.js engine', () => {
  it.each([
    {
      event: 'timeupdate',
      callback: 'onTimeUpdate',
      payload: { currentTime: 12.5, duration: 60 },
    },
    { event: 'ended', callback: 'onEnded', payload: { duration: 60 } },
    {
      event: 'playing',
      callback: 'onPlay',
      payload: { currentTime: 12.5, duration: 60 },
    },
    {
      event: 'pause',
      callback: 'onPause',
      payload: { currentTime: 12.5, duration: 60 },
    },
  ] as const)('reports $event to $callback', ({ event, callback, payload }) => {
    const report = vi.fn();
    const { video } = renderEngine({ [callback]: report });

    playhead(video, 12.5, 60);
    fireEvent(video, new Event(event));

    expect(report).toHaveBeenCalledWith(payload);
  });

  it.each([
    { control: { paused: false, muted: true }, autoplays: true, muted: true },
    { control: { paused: true, muted: false }, autoplays: false, muted: false },
    { control: undefined, autoplays: false, muted: false },
  ])('plays $control as autoplay $autoplays, muted $muted', ({ control, autoplays, muted }) => {
    const { video } = renderEngine({ layout: 'vertical', control });

    expect(video.autoplay).toBe(autoplays);
    expect(video.muted).toBe(muted);
  });

  it.each([
    { from: { paused: false, muted: true }, to: { paused: true, muted: true }, call: 'pause' },
    { from: { paused: true, muted: true }, to: { paused: false, muted: true }, call: 'play' },
  ] as const)('$call()s the media once the control changes', ({ from, to, call }) => {
    const spy = vi.spyOn(HTMLMediaElement.prototype, call).mockResolvedValue(undefined);
    const { rerender } = renderEngine({ layout: 'vertical', control: from });
    spy.mockClear();

    rerender(
      <VideoJsEngine
        playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
        title="Launch day"
        layout="vertical"
        control={to}
      />
    );

    expect(spy).toHaveBeenCalledOnce();
  });

  it('reports a stall to onWaiting', () => {
    const onWaiting = vi.fn();
    const { video } = renderEngine({ onWaiting });

    fireEvent(video, new Event('waiting'));

    expect(onWaiting).toHaveBeenCalledOnce();
  });

  it.each([
    {
      picker: 'adaptive bitrate',
      picked: false,
      level: 1,
      quality: { width: 1280, height: 720, bitrate: 2_880_000, auto: true },
    },
    {
      picker: 'the viewer',
      picked: true,
      level: 0,
      quality: { width: 640, height: 360, bitrate: 1_440_000, auto: false },
    },
  ])(
    'reports the rendition $picker picked as the active quality',
    async ({ picked, level, quality }) => {
      const onQualityChange = vi.fn();
      const { user, video } = renderEngine({ onQualityChange });
      const hls = await parseMaster(video, [360, 720], 720);

      if (picked) {
        await user.click(screen.getByRole('button', { name: 'Pick 360p' }));
      }
      act(() => {
        hls.trigger(Events.LEVEL_SWITCHED, { level });
      });

      await vi.waitFor(() => expect(onQualityChange).toHaveBeenLastCalledWith(quality));
    }
  );

  it('starts at the requested time once the metadata is in', () => {
    const { video } = renderEngine({ startTime: 42 });

    fireEvent(video, new Event('loadedmetadata'));

    expect(video.currentTime).toBe(42);
  });

  describe('with a range', () => {
    const range = { startMs: 10_000, endMs: 20_000 };

    it('starts at the range and not at the start time', () => {
      const { video } = renderEngine({ range, startTime: 42 });

      fireEvent(video, new Event('loadedmetadata'));

      expect(video.currentTime).toBe(10);
    });

    it.each([
      { at: 20, where: 'at its end', looped: true },
      { at: 25, where: 'past its end', looped: true },
      { at: 5, where: 'before its start', looped: true },
      { at: 9.8, where: 'a hair before its start', looped: false },
      { at: 15, where: 'inside it', looped: false },
    ])('goes back to the start $where: $looped', ({ at, looped }) => {
      const { video } = renderEngine({ range });

      video.currentTime = at;
      fireEvent(video, new Event('timeupdate'));

      expect(video.currentTime).toBe(looped ? 10 : at);
    });

    it('plays the range again when the video ends inside it, and reports no end', () => {
      const onEnded = vi.fn();
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { video } = renderEngine({ range, onEnded });

      fireEvent(video, new Event('ended'));

      expect([video.currentTime, play.mock.calls.length, onEnded.mock.calls.length]).toEqual([
        10, 1, 0,
      ]);
    });
  });

  it('shows the poster over the video', async () => {
    const { container } = renderEngine();

    await vi.waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', POSTER));
  });

  it('plays the video on a click on it', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const { user, video } = renderEngine();

    await user.click(video);

    expect(play).toHaveBeenCalledOnce();
  });

  it('destroys hls.js on unmount', async () => {
    const { unmount, video } = renderEngine();
    const destroy = vi.spyOn(await attachedHls(video), 'destroy');

    unmount();

    await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });
});

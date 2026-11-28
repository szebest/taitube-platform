import { fireEvent, render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { attachedHls } from '#app/integrations/video-js/__tests__/offline-hls';
import { PlayerChannelProvider, useOnPlayerEnded } from '#app/lib/player/player-channel';
import { VideoJsEngine, type VideoJsEngineProps } from '../video-js-engine';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const POSTER = 'http://localhost:9000/posters/p.jpg';

function WatchEnd({ onEnded }: { onEnded: () => void }) {
  useOnPlayerEnded(onEnded);

  return null;
}

function renderEngine(props: Partial<VideoJsEngineProps> = {}, onChannelEnded = vi.fn()) {
  const user = userEvent.setup();
  const rendered = render(
    <VideoJsEngine
      playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
      posterUrl={POSTER}
      title="Launch day"
      {...props}
    >
      <WatchEnd onEnded={onChannelEnded} />
    </VideoJsEngine>,
    { wrapper: PlayerChannelProvider }
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

  it('reports a pause when the browser refuses to autoplay, which fires no pause event', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new DOMException('', 'NotAllowedError')
    );
    const onPause = vi.fn();
    const { video } = renderEngine({
      layout: 'vertical',
      control: { paused: false, muted: true },
      onPause,
    });

    fireEvent(video, new Event('loadedmetadata'));

    await vi.waitFor(() => expect(onPause).toHaveBeenCalledOnce());
  });

  it('reports a stall to onWaiting', () => {
    const onWaiting = vi.fn();
    const { video } = renderEngine({ onWaiting });

    fireEvent(video, new Event('waiting'));

    expect(onWaiting).toHaveBeenCalledOnce();
  });

  it.each([
    { loop: true, looped: true },
    { loop: undefined, looped: false },
  ])('loops the video: $looped when loop is $loop', ({ loop, looped }) => {
    const { video } = renderEngine({ loop });

    expect(video.loop).toBe(looped);
  });

  it('fills its parent in the fill layout instead of holding a 16:9 box', () => {
    const { container } = renderEngine({ layout: 'fill' });

    expect(container.querySelector('video')?.parentElement).toHaveClass('size-full');
    expect(container.querySelector('.tw\\:aspect-video')).toBeNull();
  });

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
      { scenario: 'stops and reports the end', loop: undefined, told: 1, at: 10 },
      { scenario: 'plays again and reports no end', loop: true, told: 0, at: 10 },
    ])('$scenario at the end of the range when loop is $loop', ({ loop, told, at }) => {
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
      const onEnded = vi.fn();
      const onChannelEnded = vi.fn();
      const { video } = renderEngine({ range, loop, onEnded }, onChannelEnded);

      video.currentTime = 20;
      fireEvent(video, new Event('timeupdate'));

      expect([
        onEnded.mock.calls.length,
        onChannelEnded.mock.calls.length,
        video.currentTime,
      ]).toEqual([told, told, loop ? at : 20]);
    });
  });

  it('tells the channel once when a video without a range ends', () => {
    const onChannelEnded = vi.fn();
    const { video } = renderEngine({}, onChannelEnded);

    fireEvent(video, new Event('ended'));

    expect(onChannelEnded).toHaveBeenCalledTimes(1);
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

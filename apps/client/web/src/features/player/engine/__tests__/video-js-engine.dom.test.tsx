import { act, fireEvent, render } from '@testing-library/react';
import { Events, type Level, LoadStats, type ManifestParsedData } from 'hls.js';
import type Hls from 'hls.js';
import type { TaitubePlayerProps } from '#app/features/player';
import { VideoJsEngine } from '../video-js-engine';

const attached = vi.hoisted((): Hls[] => []);

vi.mock(import('hls.js'), async (importOriginal) => {
  const original = await importOriginal();

  class OfflineHls extends original.default {
    static override isSupported() {
      return true;
    }

    override attachMedia() {
      attached.push(this);
    }

    override loadSource() {}
  }

  return { ...original, default: OfflineHls };
});

const PLAYBACK = 'http://localhost:9000/public/videos/v1/hls/master.m3u8';

function renderPlayer(props: Partial<TaitubePlayerProps> = {}) {
  attached.length = 0;
  const rendered = render(
    <VideoJsEngine
      playbackUrl={PLAYBACK}
      posterUrl="http://localhost:9000/posters/p.jpg"
      title="Launch day"
      {...props}
    />
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  return { ...rendered, video };
}

function attachedHls(): Promise<Hls> {
  return vi.waitFor(() => {
    const hls = attached.at(-1);
    if (!hls) throw new Error('the player attached no hls.js instance yet');
    return hls;
  });
}

function manifest(heights: readonly number[]): ManifestParsedData {
  const levels = heights.map(
    (height, index) =>
      ({
        url: [`http://localhost:9000/public/videos/v1/hls/${height}p.m3u8`],
        width: (height * 16) / 9,
        height,
        videoCodec: 'avc1.64001f',
        bitrate: [800_000, 2_500_000][index],
      }) as Level
  );
  return {
    levels,
    audioTracks: [],
    subtitleTracks: [],
    sessionData: null,
    sessionKeys: null,
    firstLevel: 0,
    stats: new LoadStats(),
    audio: true,
    video: true,
    altAudio: false,
  };
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
  ] as const)('reports $event to $callback', ({ event, callback, payload }) => {
    const report = vi.fn();
    const { video } = renderPlayer({ [callback]: report });

    playhead(video, 12.5, 60);
    fireEvent(video, new Event(event));

    expect(report).toHaveBeenCalledWith(payload);
  });

  it('reports the rendition hls.js switched to as the active quality', async () => {
    const onQualityChange = vi.fn();
    renderPlayer({ onQualityChange });
    const hls = await attachedHls();

    act(() => {
      hls.trigger(Events.MANIFEST_PARSED, manifest([360, 720]));
      hls.trigger(Events.LEVEL_SWITCHED, { level: 1 });
    });

    await vi.waitFor(() =>
      expect(onQualityChange).toHaveBeenLastCalledWith({
        width: 1280,
        height: 720,
        bitrate: 2_500_000,
        auto: true,
      })
    );
  });

  it('starts at the requested time once the metadata is in', () => {
    const { video } = renderPlayer({ startTime: 42 });

    fireEvent(video, new Event('loadedmetadata'));

    expect(video.currentTime).toBe(42);
  });

  it('destroys hls.js and leaves no timer behind on unmount', async () => {
    vi.useFakeTimers();
    const { unmount } = renderPlayer();
    const hls = await attachedHls();
    const destroy = vi.spyOn(hls, 'destroy');

    unmount();
    await vi.runOnlyPendingTimersAsync();

    expect(destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

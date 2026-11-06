import { fireEvent, render } from '@testing-library/react';
import { attachedHls, parseMaster } from '#app/features/player/__tests__/offline-hls';
import { PlayerChannelProvider } from '#app/features/player/player-channel';
import type { PlaybackDefaults } from '#app/features/player/taitube-player-props';
import { VideoJsEngine, type VideoJsEngineProps } from '../video-js-engine';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/features/player/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const DEFAULTS: PlaybackDefaults = {
  speed: 1,
  quality: 'auto',
  captionsOn: false,
  captionsLanguage: null,
  captionsSize: 'medium',
  captionsBackground: 'translucent',
  statsOverlay: false,
};

function renderEngine(props: Partial<VideoJsEngineProps> = {}) {
  const rendered = render(
    <VideoJsEngine
      playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
      title="Launch day"
      {...props}
    />,
    { wrapper: PlayerChannelProvider }
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  return { ...rendered, video };
}

describe('apps/client/web: the Video.js engine starting defaults', () => {
  it('starts at the default speed it is given', async () => {
    const { video } = renderEngine({ defaults: { ...DEFAULTS, speed: 1.5 } });

    fireEvent(video, new Event('loadedmetadata'));

    expect(video.playbackRate).toBe(1.5);
  });

  it.each([
    { quality: '480p', level: 0 },
    { quality: '720p', level: 1 },
    { quality: '1080p', level: 1 },
    { quality: 'auto', level: undefined },
  ])('starts at the $quality default on a master of 480p and 720p', async ({ quality, level }) => {
    const { video } = renderEngine({ defaults: { ...DEFAULTS, quality } });
    const hls = await attachedHls(video);
    const nextLevel = vi.spyOn(hls, 'nextLevel', 'set');

    await parseMaster(video, [480, 720], 720);

    await vi.waitFor(() =>
      level === undefined
        ? expect(nextLevel).not.toHaveBeenCalled()
        : expect(nextLevel).toHaveBeenLastCalledWith(level)
    );
  });
});

import { fireEvent, render } from '@testing-library/react';
import { PlayerChannelProvider } from '#app/lib/player/player-channel';
import type { PlaybackDefaults } from '#app/lib/player/taitube-player-props';
import { VideoJsEngine, type VideoJsEngineProps } from '../video-js-engine';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
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

describe('apps/client/web: the Video.js engine starting speed', () => {
  it('starts at the default speed it is given', async () => {
    const { video } = renderEngine({ defaults: { ...DEFAULTS, speed: 1.5 } });

    fireEvent(video, new Event('loadedmetadata'));

    expect(video.playbackRate).toBe(1.5);
  });

  it.each([1.5, 2])('plays at the speed %s the control asks for', (speed) => {
    const { video } = renderEngine({
      layout: 'vertical',
      control: { paused: true, muted: true, speed },
    });

    fireEvent(video, new Event('loadedmetadata'));

    expect(video.playbackRate).toBe(speed);
  });
});

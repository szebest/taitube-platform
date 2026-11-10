import { fireEvent, render, screen } from '@testing-library/react';
import { captionTrack } from '@vp/web-testing';
import { PlayerChannelProvider } from '#app/lib/player/player-channel';
import { usePlayerState, VideoJsEngine, type VideoJsEngineProps } from '../video-js-engine';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const EN = captionTrack({ id: 'en', language: 'en', kind: 'uploaded' });

function ActiveCaptions() {
  const active = usePlayerState((state) => state.activeCaptionTrack?.id ?? 'off');

  return <output data-testid="captions">{active}</output>;
}

const engine = (props: Partial<VideoJsEngineProps>) => (
  <VideoJsEngine
    playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
    title="Launch day"
    layout="vertical"
    {...props}
  >
    <ActiveCaptions />
  </VideoJsEngine>
);

function renderEngine(props: Partial<VideoJsEngineProps>) {
  const rendered = render(engine(props), { wrapper: PlayerChannelProvider });
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  return {
    video,
    change: (next: Partial<VideoJsEngineProps>) => rendered.rerender(engine(next)),
  };
}

describe('apps/client/web: the Video.js engine control', () => {
  it.each([1.5, 2])('plays at the speed %s the control asks for', (speed) => {
    const { video } = renderEngine({ control: { paused: true, muted: true, speed } });

    fireEvent(video, new Event('loadedmetadata'));

    expect(video.playbackRate).toBe(speed);
  });

  it('follows a change of the speed the control asks for', () => {
    const { video, change } = renderEngine({ control: { paused: true, muted: true, speed: 1 } });
    fireEvent(video, new Event('loadedmetadata'));

    change({ control: { paused: true, muted: true, speed: 2 } });

    expect(video.playbackRate).toBe(2);
  });

  it.each([
    { from: false, to: true, shown: 'en' },
    { from: true, to: false, shown: 'off' },
  ])(
    'shows or hides the captions as the control goes from $from to $to',
    async ({ from, to, shown }) => {
      const control = (captions: boolean) => ({ paused: true, muted: true, captions });
      const { change } = renderEngine({ captionTracks: [EN], control: control(from) });

      change({ captionTracks: [EN], control: control(to) });

      expect(await screen.findByText(shown, { selector: 'output' })).toBeInTheDocument();
    }
  );
});

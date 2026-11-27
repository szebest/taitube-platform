import { fireEvent, screen } from '@testing-library/react';
import { renderInPlayer } from '#app/integrations/video-js/__tests__/render-in-player';
import {
  usePlayerCaptionTrack,
  usePlayerFullscreen,
  usePlayerPictureInPicture,
  usePlayerTime,
} from '#app/lib/player/player-channel';
import { ChannelBinding } from '../channel-binding';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

function ChannelState() {
  const time = usePlayerTime((seconds) => seconds);
  const fullscreen = usePlayerFullscreen();
  const { active } = usePlayerPictureInPicture();
  const captionTrack = usePlayerCaptionTrack();

  return (
    <output>{`time:${time} fullscreen:${fullscreen} pip:${active} captions:${captionTrack}`}</output>
  );
}

function renderBinding() {
  return renderInPlayer((videoRef) => (
    <>
      <ChannelState />
      <ChannelBinding videoRef={videoRef} />
    </>
  ));
}

function moveTo(video: HTMLVideoElement, event: string, seconds: number) {
  Object.defineProperty(video, 'currentTime', { configurable: true, value: seconds });
  fireEvent(video, new Event(event));
}

describe('apps/client/web: ChannelBinding', () => {
  it.each(['timeupdate', 'seeked'])('publishes the playhead on %s', (event) => {
    const { video } = renderBinding();

    moveTo(video, event, 31.5);

    expect(screen.getByRole('status')).toHaveTextContent('time:31.5');
  });

  it('publishes that nothing is fullscreen, in picture in picture or captioned at the start', () => {
    renderBinding();

    expect(screen.getByRole('status')).toHaveTextContent(
      'time:0 fullscreen:false pip:false captions:null'
    );
  });
});

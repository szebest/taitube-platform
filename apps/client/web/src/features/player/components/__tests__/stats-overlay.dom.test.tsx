import { render, screen } from '@testing-library/react';
import { IntlProvider } from '@vp/intl-react';
import { attachedHls, parseMaster } from '#app/features/player/__tests__/offline-hls';
import { VideoJsEngine } from '#app/features/player/engine/video-js-engine';
import { StatsOverlay } from '../stats-overlay';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/features/player/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

function renderOverlay(playbackRate = 1) {
  vi.spyOn(HTMLMediaElement.prototype, 'playbackRate', 'get').mockReturnValue(playbackRate);
  const rendered = render(
    <IntlProvider locale="en" timeZone="UTC">
      <VideoJsEngine
        playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
        title="Launch day"
      >
        <StatsOverlay />
      </VideoJsEngine>
    </IntlProvider>
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  return { ...rendered, video };
}

describe('apps/client/web: the player stats overlay', () => {
  it('shows the playback speed, and the quality as auto until a rendition plays', async () => {
    renderOverlay(1.5);

    await vi.waitFor(() =>
      expect(screen.getByText('Playback speed').nextElementSibling).toHaveTextContent('1.5x')
    );
    expect(screen.getByText('Quality').nextElementSibling).toHaveTextContent('Auto');
  });

  it('shows the height of the rendition that plays', async () => {
    const { video } = renderOverlay();
    await attachedHls(video);

    await parseMaster(video, [480, 720], 720);

    await vi.waitFor(() =>
      expect(screen.getByText('Quality').nextElementSibling).toHaveTextContent('720p')
    );
  });
});

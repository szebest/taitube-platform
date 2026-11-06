import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { CaptionTrackView } from '@vp/api-contracts';
import { IntlProvider } from '@vp/intl-react';
import { captionTrack } from '@vp/web-testing';
import { VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import { CaptionsButton } from '../captions-button';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

function renderButton(captionTracks: readonly CaptionTrackView[] = [captionTrack({ id: 'en' })]) {
  const user = userEvent.setup();
  const rendered = render(
    <IntlProvider locale="en" timeZone="UTC">
      <VideoJsEngine
        playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
        title="Launch day"
        captionTracks={captionTracks}
      >
        <CaptionsButton />
      </VideoJsEngine>
    </IntlProvider>
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  return { ...rendered, user, video };
}

describe('apps/client/web: the captions button', () => {
  it.each([
    { scenario: 'no captions', captionTracks: [], offered: false },
    {
      scenario: 'only a track still being generated',
      captionTracks: [captionTrack({ status: 'pending', url: null })],
      offered: false,
    },
    { scenario: 'a ready track', captionTracks: [captionTrack()], offered: true },
  ])('is offered for a video with $scenario: $offered', ({ captionTracks, offered }) => {
    renderButton(captionTracks);

    expect(screen.queryByRole('button', { name: 'Captions' }) !== null).toBe(offered);
  });

  it('turns captions on and off', async () => {
    const { user, video } = renderButton();
    const button = screen.getByRole('button', { name: 'Captions' });
    const mode = () => video.textTracks.getTrackById('en')?.mode;

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(mode()).toBe('hidden');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(mode()).toBe('disabled');
  });
});

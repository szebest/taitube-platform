import { act, render, screen } from '@testing-library/react';
import { captionTrack } from '@vp/web-testing';
import { showCues } from '@vp/web-testing/dom';
import { VideoJsEngine } from '#app/features/player/engine/video-js-engine';
import type { PlaybackDefaults } from '#app/features/player/taitube-player-props';
import { CaptionOverlay } from '../caption-overlay';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/features/player/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const DEFAULTS: PlaybackDefaults = {
  speed: 1,
  quality: 'auto',
  captionsOn: true,
  captionsLanguage: 'en',
  captionsSize: 'medium',
  captionsBackground: 'translucent',
  statsOverlay: false,
};

function renderOverlay(defaults: Partial<PlaybackDefaults> = {}) {
  const rendered = render(
    <VideoJsEngine
      playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
      title="Launch day"
      defaults={{ ...DEFAULTS, ...defaults }}
      captionTracks={[captionTrack({ id: 'en', language: 'en' })]}
    >
      <CaptionOverlay />
    </VideoJsEngine>
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  const cuesAt = (texts: readonly string[]) => act(() => showCues(video, 'en', texts));
  return { ...rendered, cuesAt };
}

describe('apps/client/web: the caption overlay', () => {
  it('draws the cues at the playhead, and nothing between cues', () => {
    const { cuesAt } = renderOverlay();

    cuesAt(['Hello and welcome']);
    expect(screen.getByText('Hello and welcome')).toBeInTheDocument();

    cuesAt([]);
    expect(screen.queryByText('Hello and welcome')).not.toBeInTheDocument();
  });

  it.each([
    {
      captionsSize: 'small',
      captionsBackground: 'none',
      classes: ['text-body-sm', '[text-shadow:0_0_0.25em_var(--scrim)]'],
    },
    {
      captionsSize: 'medium',
      captionsBackground: 'translucent',
      classes: ['text-body', 'bg-scrim'],
    },
    { captionsSize: 'large', captionsBackground: 'solid', classes: ['text-title', 'bg-bg'] },
    { captionsSize: 'xlarge', captionsBackground: 'solid', classes: ['text-title-lg', 'bg-bg'] },
  ] as const)(
    'sets the cues $captionsSize on a $captionsBackground background, as the saved preferences say',
    ({ captionsSize, captionsBackground, classes }) => {
      const { cuesAt } = renderOverlay({ captionsSize, captionsBackground });

      cuesAt(['Hello and welcome']);

      expect(screen.getByText('Hello and welcome')).toHaveClass(...classes);
    }
  );
});

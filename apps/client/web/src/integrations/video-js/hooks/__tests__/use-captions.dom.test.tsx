import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { CaptionTrackView } from '@vp/api-contracts';
import { captionTrack } from '@vp/web-testing';
import { showCues } from '@vp/web-testing/dom';
import {
  usePlayerCommands,
  usePlayerState,
  VideoJsEngine,
} from '#app/integrations/video-js/video-js-engine';
import type { PlaybackDefaults } from '#app/lib/player/taitube-player-props';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const DEFAULTS: PlaybackDefaults = {
  speed: 1,
  quality: 'auto',
  captionsOn: true,
  captionsLanguage: null,
  captionsSize: 'medium',
  captionsBackground: 'translucent',
  statsOverlay: false,
};

const FIRST_VIDEO = 'http://localhost:9000/public/videos/v1/hls/master.m3u8';

const NEXT_VIDEO = 'http://localhost:9000/public/videos/v2/hls/master.m3u8';

const EN = captionTrack({ id: 'en', language: 'en', kind: 'uploaded' });
const PL = captionTrack({ id: 'pl', language: 'pl', kind: 'auto' });

function CaptionsProbe() {
  const active = usePlayerState((state) => state.activeCaptionTrack?.id ?? 'off');
  const cues = usePlayerState((state) => state.captionCues);
  const { toggleCaptions, selectCaptionTrack } = usePlayerCommands();

  return (
    <>
      <output data-testid="active">{active}</output>
      <output data-testid="cues">{cues}</output>
      <button type="button" onClick={toggleCaptions}>
        Toggle
      </button>
      <button type="button" onClick={() => selectCaptionTrack('pl')}>
        Polish
      </button>
    </>
  );
}

function renderCaptions(
  captionTracks: readonly CaptionTrackView[] = [EN, PL],
  defaults: Partial<PlaybackDefaults> = {}
) {
  const user = userEvent.setup();
  const engine = (tracks: readonly CaptionTrackView[], playbackUrl = FIRST_VIDEO) => (
    <VideoJsEngine
      playbackUrl={playbackUrl}
      title="Launch day"
      defaults={{ ...DEFAULTS, ...defaults }}
      captionTracks={tracks}
    >
      <CaptionsProbe />
    </VideoJsEngine>
  );
  const rendered = render(engine(captionTracks));
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  const modes = () => Object.fromEntries([...video.textTracks].map(({ id, mode }) => [id, mode]));
  const rerenderWith = (tracks: readonly CaptionTrackView[], playbackUrl?: string) =>
    rendered.rerender(engine(tracks, playbackUrl));
  return { ...rendered, user, video, modes, rerenderWith };
}

describe('apps/client/web: the engine captions', () => {
  it('side-loads only the ready tracks, each as a WebVTT <track> of its language', () => {
    const { video } = renderCaptions([
      EN,
      captionTrack({ id: 'pending', status: 'pending', url: null }),
      captionTrack({ id: 'failed', status: 'failed', url: null }),
    ]);

    expect(
      [...video.querySelectorAll('track')].map(({ id, kind, srclang, src }) => ({
        id,
        kind,
        srclang,
        src,
      }))
    ).toEqual([{ id: 'en', kind: 'captions', srclang: 'en', src: EN.url }]);
  });

  it.each([
    { scenario: 'the chosen language', captionsOn: true, language: 'pl', shown: 'pl' },
    {
      scenario: 'a browser language with nothing chosen',
      captionsOn: true,
      language: null,
      shown: 'en',
    },
    {
      scenario: 'no track while the default is off',
      captionsOn: false,
      language: 'pl',
      shown: 'off',
    },
  ])('starts with $scenario, the rest disabled', ({ captionsOn, language, shown }) => {
    const { modes } = renderCaptions([EN, PL], { captionsOn, captionsLanguage: language });

    expect(screen.getByTestId('active')).toHaveTextContent(shown);
    expect(modes()).toEqual({
      en: shown === 'en' ? 'hidden' : 'disabled',
      pl: shown === 'pl' ? 'hidden' : 'disabled',
    });
  });

  it('reads the cues of the shown track at the playhead, one line each', () => {
    const { video } = renderCaptions([EN], { captionsLanguage: 'en' });

    act(() => showCues(video, 'en', ['Hello and welcome', 'to the show']));

    expect(screen.getByTestId('cues').textContent).toBe('Hello and welcome\nto the show');
  });

  it('turns captions off and back on with the track shown last', async () => {
    const { user, modes } = renderCaptions([EN, PL], { captionsOn: false });

    await user.click(screen.getByRole('button', { name: 'Polish' }));
    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByTestId('active')).toHaveTextContent('off');
    expect(modes()).toEqual({ en: 'disabled', pl: 'disabled' });

    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByTestId('active')).toHaveTextContent('pl');
  });

  it('turns on the track a video starts with when none was shown yet', async () => {
    const { user } = renderCaptions([EN, PL], { captionsOn: false, captionsLanguage: 'en' });

    await user.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByTestId('active')).toHaveTextContent('en');
  });

  it('shows a track that becomes ready while the video plays, in the same <video>', async () => {
    const { video, rerenderWith, modes, container } = renderCaptions([]);

    rerenderWith([EN]);

    expect(screen.getByTestId('active')).toHaveTextContent('en');
    await vi.waitFor(() => expect(modes()).toEqual({ en: 'hidden' }));
    expect(container.querySelector('video')).toBe(video);
  });

  it.each([
    { scenario: 'a track picked', press: 'Polish' },
    { scenario: 'captions turned off', press: 'Toggle' },
  ])(
    'starts the next video in the same player on its own defaults after $scenario on the last one',
    async ({ press }) => {
      const { user, rerenderWith } = renderCaptions([EN, PL], { captionsLanguage: 'en' });
      await user.click(screen.getByRole('button', { name: press }));

      rerenderWith(
        [
          captionTrack({ id: 'next-en', language: 'en', kind: 'uploaded' }),
          captionTrack({ id: 'next-pl', language: 'pl', kind: 'auto' }),
        ],
        NEXT_VIDEO
      );

      expect(screen.getByTestId('active')).toHaveTextContent('next-en');
    }
  );
});

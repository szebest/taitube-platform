import { screen } from '@testing-library/react';
import { captionTrack } from '@vp/web-testing';
import { renderInPlayer } from '#app/integrations/video-js/__tests__/render-in-player';
import { useCaptionsContext } from '#app/integrations/video-js/hooks/use-captions';
import type { PlaybackControl } from '#app/lib/player/taitube-player-props';
import { PlaybackSync } from '../playback-sync';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

const EN = captionTrack({ id: 'en', language: 'en', kind: 'uploaded' });

function ActiveCaptions() {
  const { state } = useCaptionsContext();

  return <output>{state.activeCaptionTrack?.id ?? 'off'}</output>;
}

function renderSync(control: PlaybackControl, captionTracks?: (typeof EN)[]) {
  const ui = (next: PlaybackControl) => () => (
    <>
      <PlaybackSync {...next} />
      <ActiveCaptions />
    </>
  );
  const rendered = renderInPlayer(ui(control), captionTracks);

  return { ...rendered, change: (next: PlaybackControl) => rendered.change(ui(next)) };
}

describe('apps/client/web: PlaybackSync', () => {
  it.each([
    { from: false, to: true, call: 'pause' },
    { from: true, to: false, call: 'play' },
  ] as const)('$call()s the media once the control changes', ({ from, to, call }) => {
    const spy = vi.spyOn(HTMLMediaElement.prototype, call).mockResolvedValue(undefined);
    const { change } = renderSync({ paused: from, muted: true });
    spy.mockClear();

    change({ paused: to, muted: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it('leaves the media as it started while the control does not change', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const { change } = renderSync({ paused: false, muted: true });

    change({ paused: false, muted: true });

    expect([play.mock.calls.length, pause.mock.calls.length]).toEqual([0, 0]);
  });

  it.each([
    { from: true, to: false },
    { from: false, to: true },
  ])('mutes or unmutes the media as the control goes from $from to $to', ({ from, to }) => {
    const { video, change } = renderSync({ paused: true, muted: from });
    video.muted = from;

    change({ paused: true, muted: to });

    expect(video.muted).toBe(to);
  });

  it('follows a change of the speed the control asks for', () => {
    const { video, change } = renderSync({ paused: true, muted: true, speed: 1 });

    change({ paused: true, muted: true, speed: 2 });

    expect(video.playbackRate).toBe(2);
  });

  it.each([
    { from: false, to: true, shown: 'en' },
    { from: true, to: false, shown: 'off' },
  ])(
    'shows or hides the captions as the control goes from $from to $to',
    async ({ from, to, shown }) => {
      const control = (captions: boolean) => ({ paused: true, muted: true, captions });
      const { change } = renderSync(control(from), [EN]);

      change(control(to));

      expect(await screen.findByText(shown, { selector: 'output' })).toBeInTheDocument();
    }
  );
});

import { screen, within } from '@testing-library/react';
import { type CaptionTrackView, getTranscript, listCaptions } from '@vp/api-contracts';
import { videoKeys } from '@vp/queries';
import { writeCookie } from '@vp/ui';
import { CAPTION_ID, VIDEO_ID, captionTrack, mockEndpoint, transcript } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/features/player/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

/**
 * The watch page, with the real player, of a video whose captions are `tracks` until `ready` swaps
 * them and refreshes the captions as the `captions.ready` handler of `@vp/queries` does.
 */
async function renderWithCaptions(tracks: CaptionTrackView[]) {
  let served = tracks;
  const languages: (string | null)[] = [];
  const rendered = await renderWatch({
    handlers: [
      mockEndpoint(listCaptions, () => HttpResponse.json({ tracks: served })),
      mockEndpoint(getTranscript, ({ request }) => {
        const lang = new URL(request.url).searchParams.get('lang');
        languages.push(lang);
        return HttpResponse.json(transcript({ language: lang }));
      }),
    ],
  });
  const ready = (next: CaptionTrackView[]) => {
    served = next;
    void rendered.queryClient.invalidateQueries({ queryKey: videoKeys.captions(VIDEO_ID) });
  };
  return { ...rendered, languages, ready };
}

describe('apps/client/web: the watch page transcript', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it.each([
    { scenario: 'no captions', tracks: [] },
    {
      scenario: 'only a track still being generated',
      tracks: [captionTrack({ status: 'pending', url: null })],
    },
  ])('is not on the page of a video with $scenario', async ({ tracks }) => {
    const { queryClient } = await renderWithCaptions(tracks);
    await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(screen.queryByRole('region', { name: 'Transcript' })).not.toBeInTheDocument();
  });

  it('reads the track in the language the viewer saved, before the player shows any', async () => {
    writeCookie(
      'vp.device',
      JSON.stringify({ schema: 1, playback: { captionsLanguage: 'pl' }, locale: null }),
      { maxAge: 60 }
    );
    const { user, languages } = await renderWithCaptions([
      captionTrack({ id: CAPTION_ID, language: 'en', kind: 'auto' }),
      captionTrack({ id: '0190c3a0-5e1d-7000-8000-00000000f002', language: 'pl' }),
    ]);

    const panel = await screen.findByRole('region', { name: 'Transcript' });
    await user.click(within(panel).getByRole('button', { name: 'Transcript' }));

    await vi.waitFor(() => expect(languages).toEqual(['pl']));
  });

  it('brings the captions button and the transcript once captions.ready lands, without restarting the player', async () => {
    const { ready } = await renderWithCaptions([]);
    const video = document.querySelector('video');
    expect(screen.queryByRole('button', { name: 'Captions' })).not.toBeInTheDocument();

    ready([captionTrack()]);

    expect(await screen.findByRole('button', { name: 'Captions' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Transcript' })).toBeInTheDocument();
    expect(document.querySelector('video')).toBe(video);
  });
});

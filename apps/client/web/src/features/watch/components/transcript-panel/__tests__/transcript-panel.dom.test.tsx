import { screen, within } from '@testing-library/react';
import { getTranscript, listCaptions } from '@vp/api-contracts';
import { captionTrack, mockEndpoint, transcript } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/features/watch/__tests__/render-watch';
import { stubSeek } from '#app/features/watch/__tests__/stub-player';

vi.mock(import('#app/features/player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const CUES = [
  { index: 0, startMs: 0, endMs: 60_000, text: 'Hello and welcome' },
  { index: 1, startMs: 60_000, endMs: 90_000, text: 'Today we bake bread' },
  { index: 2, startMs: 90_000, endMs: 120_000, text: 'First the flour' },
];

/** jsdom lays nothing out, and the list mounts only the rows its scroll box has room for. */
const LAID_OUT_HEIGHT = 400;

/** The watch page of a video with an English track, the stub player at 75 s, and the transcript opened. */
async function renderTranscript() {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(LAID_OUT_HEIGHT);
  const searches: (string | null)[] = [];
  const rendered = await renderWatch({
    handlers: [
      mockEndpoint(listCaptions, () => HttpResponse.json({ tracks: [captionTrack()] })),
      mockEndpoint(getTranscript, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        searches.push(q);
        const cues = q ? CUES.filter(({ text }) => text.includes(q)) : CUES;
        return HttpResponse.json(transcript({ cues }));
      }),
    ],
  });
  const panel = await screen.findByRole('region', { name: 'Transcript' });
  await rendered.user.click(within(panel).getByRole('button', { name: 'Transcript' }));
  await within(panel).findByRole('button', { name: /Hello and welcome/ });
  return { ...rendered, panel, searches };
}

describe('apps/client/web: the transcript panel', () => {
  it('lists the cues with their start times and marks the one at the playhead', async () => {
    const { panel } = await renderTranscript();

    expect(
      within(panel)
        .getAllByRole('listitem')
        .map(({ textContent }) => textContent)
    ).toEqual(['00:00Hello and welcome', '01:00Today we bake bread', '01:30First the flour']);
    expect(within(panel).getByRole('button', { current: true })).toHaveTextContent(
      'Today we bake bread'
    );
  });

  it('seeks the player to the start of the cue clicked', async () => {
    const { user, panel } = await renderTranscript();

    await user.click(within(panel).getByRole('button', { name: /First the flour/ }));

    expect(stubSeek).toHaveBeenLastCalledWith(90);
  });

  it('keeps only the cues that match a search of two letters or more, each still seeking', async () => {
    const { user, panel, searches } = await renderTranscript();
    const search = within(panel).getByRole('searchbox', { name: 'Search the transcript' });

    await user.type(search, 'f');
    await user.type(search, 'lour');

    await vi.waitFor(() =>
      expect(
        within(panel)
          .getAllByRole('listitem')
          .map(({ textContent }) => textContent)
      ).toEqual(['01:30First the flour'])
    );
    expect(searches).toEqual([null, 'flour']);
    await user.click(within(panel).getByRole('button', { name: /First the flour/ }));
    expect(stubSeek).toHaveBeenLastCalledWith(90);
  });

  it('says so when nothing matches the search', async () => {
    const { user, panel } = await renderTranscript();

    await user.type(
      within(panel).getByRole('searchbox', { name: 'Search the transcript' }),
      'butter'
    );

    expect(
      await within(panel).findByText('Nothing in the transcript matches butter')
    ).toBeInTheDocument();
  });
});

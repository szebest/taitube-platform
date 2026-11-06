import { screen, within } from '@testing-library/react';
import { VIDEO_ID, captionTrack } from '@vp/web-testing';
import { BROKEN_VTT, serveCaptions } from '#app/features/captions/__tests__/captions-api.fixture';
import { renderCaptions } from '#app/features/captions/__tests__/render-captions';
import { CaptionTrackRow } from '../caption-track-row';

const READY_EN = captionTrack({ version: 3 });
const EDITED_EN = captionTrack({ kind: 'edited', version: 3 });
const GOOD_VTT = 'WEBVTT\n\n00:00.000 --> 00:01.000\nHi\n';
const vtt = (text: string) => new File([text], 'en.vtt', { type: 'text/vtt' });

function renderRow(held = READY_EN) {
  const served = serveCaptions({ tracks: [held] });
  const rendered = renderCaptions(
    <ul>
      <CaptionTrackRow videoId={VIDEO_ID} track={held} />
    </ul>,
    served.handlers
  );
  return { ...rendered, ...served };
}

const button = (name: string) => screen.getByRole('button', { name });

describe('apps/client/studio: CaptionTrackRow', () => {
  it.each([
    { scenario: 'ready, nobody edited it', held: READY_EN, offers: ['Edit cues', 'Regenerate'] },
    {
      scenario: 'failed',
      held: captionTrack({ status: 'failed', url: null, reason: 'WHISPER_FAILED' }),
      offers: ['Retry'],
    },
    { scenario: 'pending', held: captionTrack({ status: 'pending', url: null }), offers: [] },
    {
      scenario: 'uploaded',
      held: captionTrack({ kind: 'uploaded' }),
      offers: ['Edit cues'],
    },
  ])('offers what fits a track that is $scenario', ({ held, offers }) => {
    renderRow(held);
    const row = screen.getByRole('listitem');

    for (const name of ['Edit cues', 'Retry', 'Regenerate']) {
      const present = within(row).queryByRole('button', { name }) !== null;
      expect(present, name).toBe(offers.includes(name));
    }
  });

  it('replaces the track with an uploaded .vtt file', async () => {
    const { user, writes } = renderRow();

    await user.upload(screen.getByLabelText('Choose a .vtt file'), vtt(GOOD_VTT));

    expect(await screen.findByText('Track uploaded')).toBeInTheDocument();
    expect(writes.uploads).toEqual([{ language: 'en', body: GOOD_VTT }]);
  });

  it.each([
    {
      scenario: 'a malformed file, naming its line',
      file: vtt(BROKEN_VTT),
      words: 'Line 3: expected a timing line',
      uploads: 1,
    },
    {
      scenario: 'a file over 1 MiB, before it is sent',
      file: vtt('x'.repeat(1_048_577)),
      words: 'The file is over 1 MiB.',
      uploads: 0,
    },
  ])('refuses $scenario', async ({ file, words, uploads }) => {
    const { user, writes } = renderRow();

    await user.upload(screen.getByLabelText('Choose a .vtt file'), file);

    expect(await screen.findByRole('alert')).toHaveTextContent(words);
    expect(writes.uploads).toHaveLength(uploads);
  });

  it.each([
    { scenario: 'a track nobody edited', held: READY_EN, label: 'Regenerate' },
    {
      scenario: 'a failed track',
      held: captionTrack({ status: 'failed', url: null, reason: 'WHISPER_FAILED' }),
      label: 'Retry',
    },
  ])('starts $scenario again at once, with no question', async ({ held, label }) => {
    const { user, writes } = renderRow(held);

    await user.click(button(label));

    expect(await screen.findByText('Generating captions')).toBeInTheDocument();
    expect(writes.generates).toEqual([{ language: 'en', overwrite: false }]);
  });

  it('asks before regenerating over an edited track, and sends overwrite only once confirmed', async () => {
    const { user, writes } = renderRow(EDITED_EN);

    await user.click(button('Regenerate'));
    expect(await screen.findByText('Replace your changes?')).toBeInTheDocument();
    expect(writes.generates).toEqual([{ language: 'en', overwrite: false }]);

    await user.click(button('Regenerate and replace'));

    expect(await screen.findByText('Generating captions')).toBeInTheDocument();
    expect(writes.generates).toEqual([
      { language: 'en', overwrite: false },
      { language: 'en', overwrite: true },
    ]);
  });

  it('leaves an edited track alone when the creator declines to replace it', async () => {
    const { user, writes } = renderRow(EDITED_EN);

    await user.click(button('Regenerate'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(writes.generates).toHaveLength(1);
  });

  it('deletes the track only after a confirmation', async () => {
    const { user, writes } = renderRow();

    await user.click(button('Delete track'));
    expect(writes.deletes).toEqual([]);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete track' })
    );

    expect(await screen.findByText('Track deleted')).toBeInTheDocument();
    expect(writes.deletes).toEqual(['en']);
  });
});

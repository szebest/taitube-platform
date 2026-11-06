import { screen, within } from '@testing-library/react';
import { listCaptions } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { videoKeys } from '@vp/queries';
import { VIDEO_ID, apiServer, captionTrack, mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { serveCaptions } from '../../__tests__/captions-api.fixture';
import { renderCaptions } from '../../__tests__/render-captions';
import { CaptionsSection } from '../captions-section';

const READY_EN = captionTrack({ id: '0190c3a0-5e1d-7000-8000-00000000f001', version: 3 });

async function renderSection(initial: Parameters<typeof serveCaptions>[0] = {}) {
  const served = serveCaptions(initial);
  const rendered = renderCaptions(<CaptionsSection videoId={VIDEO_ID} />, served.handlers);
  await screen.findByRole('heading', { name: 'Captions' });
  return { ...rendered, ...served };
}

const track = (name: string) => screen.findByRole('listitem', { name });

describe('apps/client/studio: CaptionsSection', () => {
  it('switches captions on for an existing video, and its pending track turns ready on captions.ready without a reload', async () => {
    const { user, writes, state, queryClient } = await renderSection();

    await user.click(await screen.findByRole('combobox', { name: 'Generated captions' }));
    await user.click(await screen.findByRole('option', { name: 'On' }));

    expect(writes.settings).toEqual([{ autoCaptions: true }]);
    expect(within(await track('English')).getByText('Pending')).toBeInTheDocument();

    state.tracks = [captionTrack()];
    await queryClient.invalidateQueries({ queryKey: videoKeys.captions(VIDEO_ID) });

    expect(await within(await track('English')).findByText('Ready')).toBeInTheDocument();
  });

  it('lists each track with its kind and status, and says why a track failed or is off', async () => {
    await renderSection({
      tracks: [
        READY_EN,
        captionTrack({
          id: '0190c3a0-5e1d-7000-8000-00000000f002',
          language: 'pl',
          kind: 'uploaded',
        }),
        captionTrack({
          id: '0190c3a0-5e1d-7000-8000-00000000f003',
          language: 'de',
          status: 'failed',
          url: null,
          reason: 'WHISPER_FAILED',
        }),
        captionTrack({
          id: '0190c3a0-5e1d-7000-8000-00000000f004',
          language: null,
          status: 'disabled',
          url: null,
          reason: 'NO_AUDIO',
        }),
      ],
    });

    expect(within(await track('English')).getByText('Auto-generated')).toBeInTheDocument();
    expect(within(await track('Polish')).getByText('Uploaded')).toBeInTheDocument();
    expect(
      within(await track('German')).getByText('Generating captions for this video failed.')
    ).toBeInTheDocument();
    expect(
      within(await track('Language not detected yet')).getByText(
        'This video has no audio to caption.'
      )
    ).toBeInTheDocument();
  });

  it('says so when the video has no tracks yet', async () => {
    await renderSection();

    expect(await screen.findByText('No caption tracks yet.')).toBeInTheDocument();
  });

  it('says the captions did not load, and loads them again on retry', async () => {
    const { user } = renderCaptions(<CaptionsSection videoId={VIDEO_ID} />, [
      mockEndpoint(listCaptions, () => problemReply(ErrorCodes.INTERNAL)),
    ]);
    expect(await screen.findByText('The captions did not load.')).toBeInTheDocument();

    apiServer.use(...serveCaptions({ tracks: [READY_EN] }).handlers);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await track('English')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    await renderSection({ tracks: [READY_EN] });
    await track('English');

    expect(await axeViolations()).toEqual([]);
  });
});

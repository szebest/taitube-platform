import { screen } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';
import { BROKEN_VTT, serveCaptions } from '#app/__tests__/captions-api.fixture';
import { renderCaptions } from '#app/features/captions/__tests__/render-captions';
import { AddTrackForm } from '../add-track-form';

function renderForm(taken: string[] = []) {
  const served = serveCaptions();
  const rendered = renderCaptions(
    <AddTrackForm videoId={VIDEO_ID} taken={taken} />,
    served.handlers
  );
  return { ...rendered, ...served };
}

const vtt = (text: string) => new File([text], 'pt.vtt', { type: 'text/vtt' });

describe('apps/client/studio: AddTrackForm', () => {
  it.each(['en', 'EN '])(
    'refuses %j, which the video already has, and points at Replace',
    async (typed) => {
      const { user } = renderForm(['en']);

      await user.type(screen.getByLabelText('Language code'), typed);

      expect(
        screen.getByText('This video already has a track in English. Use Replace on it.')
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Choose a .vtt file')).toBeNull();
    }
  );

  it('offers the file only once there is a language to put it under', async () => {
    const { user } = renderForm();
    expect(screen.queryByLabelText('Choose a .vtt file')).toBeNull();

    await user.type(screen.getByLabelText('Language code'), 'pt-BR');

    expect(screen.getByLabelText('Choose a .vtt file')).toBeInTheDocument();
  });

  it('adds a track under the tag typed, and clears the tag', async () => {
    const { user, writes } = renderForm();

    await user.type(screen.getByLabelText('Language code'), 'pt-BR');
    await user.upload(screen.getByLabelText('Choose a .vtt file'), vtt('WEBVTT\n'));

    expect(await screen.findByText('Track uploaded')).toBeInTheDocument();
    expect(writes.uploads).toEqual([{ language: 'pt-BR', body: 'WEBVTT\n' }]);
    expect(screen.getByLabelText('Language code')).toHaveValue('');
  });

  it('shows the line of a malformed file on the field and keeps the tag', async () => {
    const { user } = renderForm();

    await user.type(screen.getByLabelText('Language code'), 'pt-BR');
    await user.upload(screen.getByLabelText('Choose a .vtt file'), vtt(BROKEN_VTT));

    expect(await screen.findByText('Line 3: expected a timing line')).toBeInTheDocument();
    expect(screen.getByLabelText('Language code')).toHaveValue('pt-BR');
  });
});

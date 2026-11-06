import { screen } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';
import { serveCaptions } from '#app/features/captions/__tests__/captions-api.fixture';
import { renderCaptions } from '#app/features/captions/__tests__/render-captions';
import { AutoCaptionsSelect } from '../auto-captions-select';

function renderSelect(autoCaptions: boolean | null, channelDefault = false) {
  const served = serveCaptions({ autoCaptions, channelDefault });
  const rendered = renderCaptions(
    <AutoCaptionsSelect videoId={VIDEO_ID} settings={{ autoCaptions, channelDefault }} />,
    served.handlers
  );
  return { ...rendered, ...served };
}

const select = () => screen.getByRole('combobox', { name: 'Generated captions' });

describe('apps/client/studio: AutoCaptionsSelect', () => {
  it.each([
    { autoCaptions: true, channelDefault: false, shown: 'On' },
    { autoCaptions: false, channelDefault: true, shown: 'Off' },
    {
      autoCaptions: null,
      channelDefault: true,
      shown: 'Follow the channel default (currently on)',
    },
    {
      autoCaptions: null,
      channelDefault: false,
      shown: 'Follow the channel default (currently off)',
    },
  ])(
    'shows $shown for a video switched $autoCaptions over a channel default of $channelDefault',
    ({ autoCaptions, channelDefault, shown }) => {
      renderSelect(autoCaptions, channelDefault);

      expect(select()).toHaveTextContent(shown);
    }
  );

  it.each([
    { choice: 'Off', body: { autoCaptions: false } },
    { choice: 'Follow the channel default (currently off)', body: { autoCaptions: null } },
  ])('sends $body when the creator picks $choice', async ({ choice, body }) => {
    const { user, writes } = renderSelect(true);

    await user.click(select());
    await user.click(await screen.findByRole('option', { name: choice }));

    expect(writes.settings).toEqual([body]);
  });
});

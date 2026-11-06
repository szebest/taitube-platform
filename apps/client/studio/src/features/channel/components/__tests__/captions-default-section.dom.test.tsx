import { screen, within } from '@testing-library/react';
import { setChannelAutoCaptions } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Captions' });
const toggle = () =>
  within(section()).getByRole('switch', { name: 'Generate captions for new uploads' });
const save = () => within(section()).getByRole('button', { name: 'Save' });

function savesDefault(bodies: unknown[] = []) {
  return mockEndpoint(setChannelAutoCaptions, async ({ request }) => {
    const body = await request.json();
    bodies.push(body);
    return HttpResponse.json({ enabled: body.enabled });
  });
}

describe('apps/client/studio: captions default section', () => {
  it.each([
    { autoCaptionsDefault: false, checked: false },
    { autoCaptionsDefault: true, checked: true },
  ])('shows the default the channel has when it is $autoCaptionsDefault', async (own) => {
    await renderCustomization({ autoCaptionsDefault: own.autoCaptionsDefault });

    expect(toggle()).toHaveAttribute('aria-checked', String(own.checked));
    expect(save()).toBeDisabled();
  });

  it('saves the switch on its own and rests on it', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization({}, [savesDefault(bodies)]);

    await user.click(toggle());
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ enabled: true }]);
    expect(save()).toBeDisabled();
  });

  it('says the save failed and keeps the switch where the creator left it', async () => {
    const { user } = await renderCustomization({}, [
      mockEndpoint(setChannelAutoCaptions, () => problemReply(ErrorCodes.CHANNEL_NOT_FOUND)),
    ]);

    await user.click(toggle());
    await user.click(save());

    expect(await within(section()).findByRole('alert')).toBeInTheDocument();
    expect(toggle()).toBeChecked();
  });
});

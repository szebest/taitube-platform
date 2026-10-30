import { screen, within } from '@testing-library/react';
import { updateMyChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';

import {
  renderCustomization,
  savesChannel,
} from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Name and handle' });
const save = () => within(section()).getByRole('button', { name: 'Save' });

async function renderIdentity(handlers: Parameters<typeof renderCustomization>[1] = []) {
  const { user } = await renderCustomization({}, handlers);
  const retype = async (label: string, text: string) => {
    const input = within(section()).getByLabelText(label);
    await user.clear(input);
    await user.type(input, text);
  };
  return { user, retype };
}

describe('apps/client/studio: identity section', () => {
  it('opens on the channel as it is, with nothing to save', async () => {
    await renderIdentity();

    expect(within(section()).getByLabelText('Channel name')).toHaveValue('The Creator');
    expect(within(section()).getByLabelText('Handle')).toHaveValue('creator');
    expect(save()).toBeDisabled();
  });

  it.each([
    { label: 'Handle', text: 'no spaces', message: 'Invalid handle format' },
    { label: 'Channel name', text: ' ', message: 'Use 1 to 100 characters.' },
  ])('refuses "$text" for $label before asking the API', async ({ label, text, message }) => {
    const bodies: unknown[] = [];
    const { retype } = await renderIdentity([savesChannel({}, bodies)]);

    await retype(label, text);

    expect(await within(section()).findByText(new RegExp(message))).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(bodies).toEqual([]);
  });

  it('sends the trimmed name and handle, and says it saved', async () => {
    const bodies: unknown[] = [];
    const { user, retype } = await renderIdentity([savesChannel({}, bodies)]);

    await retype('Channel name', ' New Name ');
    await retype('Handle', 'new.handle');
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ displayName: 'New Name', handle: 'new.handle' }]);
    expect(save()).toBeDisabled();
  });

  it.each([
    { code: ErrorCodes.HANDLE_ALREADY_TAKEN, words: 'This handle is already taken.' },
    { code: ErrorCodes.INVALID_HANDLE_FORMAT, words: 'Handles use lowercase letters' },
  ])('shows $code on the handle itself', async ({ code, words }) => {
    const { user, retype } = await renderIdentity([
      mockEndpoint(updateMyChannel, () => problemReply(code)),
    ]);

    await retype('Handle', 'taken');
    await user.click(save());

    expect(await within(section()).findByText(new RegExp(words))).toBeInTheDocument();
    expect(within(section()).getByLabelText('Handle')).toBeInvalid();
    await user.type(within(section()).getByLabelText('Handle'), 'x');
    expect(within(section()).queryByText(new RegExp(words))).toBeNull();
  });

  it('says the section did not save when the API failed for any other reason', async () => {
    const { user, retype } = await renderIdentity([
      mockEndpoint(updateMyChannel, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await retype('Channel name', 'Other');
    await user.click(save());

    expect(await within(section()).findByRole('alert')).toHaveTextContent(
      'Could not save. Try again.'
    );
  });
});

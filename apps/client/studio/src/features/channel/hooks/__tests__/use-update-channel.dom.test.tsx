import { screen, within } from '@testing-library/react';
import { updateMyChannel } from '@vp/api-contracts';
import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { SESSION_KEY, type Session } from '@vp/queries';
import { mockEndpoint, problemReply } from '@vp/web-testing';

import { renderCustomization, savesChannel } from '../../__tests__/render-customization';
import { failureCodeOf } from '../use-update-channel';

describe('apps/client/studio: useUpdateChannel', () => {
  it('writes the saved channel into the session the whole app reads, so the account menu follows', async () => {
    const { user, queryClient } = await renderCustomization({}, [savesChannel()]);
    const section = screen.getByRole('form', { name: 'Name and handle' });

    await user.clear(within(section).getByLabelText('Channel name'));
    await user.type(within(section).getByLabelText('Channel name'), 'Renamed');
    await user.click(within(section).getByRole('button', { name: 'Save' }));

    expect(await within(section).findByText('Saved')).toBeInTheDocument();
    const session = queryClient.getQueryData<Session>(SESSION_KEY);
    expect(session?.status === 'signed-in' && session.account.channel.displayName).toBe('Renamed');
    expect(
      screen.getByRole('button', { name: 'Account' }).querySelector('[data-slot="avatar-fallback"]')
    ).toHaveTextContent('R');
  });

  it('leaves the session as it was when the API refuses', async () => {
    const { user, queryClient } = await renderCustomization({}, [
      mockEndpoint(updateMyChannel, () => problemReply(ErrorCodes.HANDLE_ALREADY_TAKEN)),
    ]);
    const section = screen.getByRole('form', { name: 'Name and handle' });

    await user.type(within(section).getByLabelText('Handle'), 'x');
    await user.click(within(section).getByRole('button', { name: 'Save' }));

    await within(section).findByText('This handle is already taken.');
    const session = queryClient.getQueryData<Session>(SESSION_KEY);
    expect(session?.status === 'signed-in' && session.account.channel.handle).toBe('creator');
  });

  it.each([
    {
      scenario: 'an API refusal',
      error: new ApiError(409, ErrorCodes.HANDLE_ALREADY_TAKEN, 'taken'),
      code: ErrorCodes.HANDLE_ALREADY_TAKEN,
    },
    {
      scenario: 'a code this app does not know',
      error: new ApiError(500, 'HTTP_ERROR', 'down'),
      code: undefined,
    },
    {
      scenario: 'a failure that is not an API answer',
      error: new Error('offline'),
      code: undefined,
    },
  ])('names the code of $scenario', ({ error, code }) => {
    expect(failureCodeOf(error)).toBe(code);
  });
});

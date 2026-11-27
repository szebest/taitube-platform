import { screen, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';

async function openDialog(options: Parameters<typeof renderTeam>[1] = {}) {
  const rendered = await renderTeam('/team', options);
  await rendered.user.click(
    (await screen.findAllByRole('button', { name: 'Invite someone' }))[0] as HTMLElement
  );
  const dialog = await screen.findByRole('dialog', { name: 'Invite to the team' });
  return { ...rendered, dialog };
}

async function pickNewcomer({ user, dialog }: Awaited<ReturnType<typeof openDialog>>) {
  await user.type(within(dialog).getByRole('combobox'), 'newcomer');
  await user.click(await within(dialog).findByRole('option', { name: /New Comer/ }));
}

describe('apps/client/studio: InviteDialog', () => {
  it('sends the handle that was found with the chosen role, and lists the invite once it is sent', async () => {
    const opened = await openDialog();
    await pickNewcomer(opened);

    await opened.user.click(within(opened.dialog).getByRole('radio', { name: 'Moderator' }));
    await opened.user.click(within(opened.dialog).getByRole('button', { name: 'Send invite' }));

    expect(await screen.findByText('Invite sent to New Comer')).toBeInTheDocument();
    expect(opened.requests.invited).toEqual([{ handle: 'newcomer', role: 'moderator' }]);
    expect(
      await screen.findByRole('table', { name: 'Invites that nobody has answered yet' })
    ).toBeInTheDocument();
  });

  it('describes the chosen role and what it can do', async () => {
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole('radio', { name: 'Analytics viewer' }));

    expect(
      within(dialog).getByText('Reads analytics and videos, changes nothing.')
    ).toBeInTheDocument();
    expect(within(dialog).getByText('A Analytics viewer can')).toBeInTheDocument();
  });

  it('says no channel has a handle nobody uses, and sends nothing until one is chosen', async () => {
    const { user, dialog, requests } = await openDialog();

    await user.type(within(dialog).getByRole('combobox'), 'nobody');

    expect(await within(dialog).findByText('No channel has that handle')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send invite' })).toBeDisabled();
    expect(requests.invited).toEqual([]);
  });

  it.each([
    { code: ErrorCodes.CHANNEL_MEMBER_EXISTS, message: 'They are already on the team.' },
    {
      code: ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING,
      message: 'They already have a pending invite.',
    },
  ])('says so when the API answers $code', async ({ code, message }) => {
    const opened = await openDialog({ inviteFailure: code });
    await pickNewcomer(opened);

    await opened.user.click(within(opened.dialog).getByRole('button', { name: 'Send invite' }));

    expect(await within(opened.dialog).findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Invite to the team' })).toBeInTheDocument();
  });

  it('offers a manager every role but manager', async () => {
    const { dialog } = await openDialog({
      state: { memberships: [membership('manager')] },
      actingOn: OTHER_CHANNEL_ID,
    });

    expect(within(dialog).getByRole('radio', { name: 'Manager' })).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: 'Editor' })).toBeEnabled();
  });
});

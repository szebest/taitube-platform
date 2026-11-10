import { screen, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { MY_INVITE_ID, myInvite } from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: InviteCard', () => {
  it('accepts, drops the invite and lists the channel in the switcher without a reload', async () => {
    const { user, requests } = await renderTeam('/invites', {
      state: { myInvites: [myInvite('editor')] },
    });
    expect(screen.queryByRole('button', { name: 'Switch channel' })).toBeNull();

    await user.click(
      await screen.findByRole('button', { name: 'Accept the invite to Other Show' })
    );

    expect(await screen.findByText('You joined Other Show')).toBeInTheDocument();
    expect(requests.accepted).toEqual([MY_INVITE_ID]);
    await vi.waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Pending invites' })).toBeNull()
    );
    await user.click(await screen.findByRole('button', { name: 'Switch channel' }));
    expect(await screen.findByRole('menuitemradio', { name: /Other Show/ })).toHaveTextContent(
      'Editor'
    );
  });

  it('declines and drops the invite', async () => {
    const { user, requests } = await renderTeam('/invites', {
      state: { myInvites: [myInvite('editor')] },
    });

    await user.click(
      await screen.findByRole('button', { name: 'Decline the invite to Other Show' })
    );

    expect(await screen.findByText('You declined the invite to Other Show')).toBeInTheDocument();
    expect(requests.declined).toEqual([MY_INVITE_ID]);
    expect(await screen.findByText('No invites')).toBeInTheDocument();
  });

  it.each([
    {
      scenario: 'closed, revoked or expired',
      code: ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
      reason: 'This invite was revoked, answered or has expired.',
    },
    {
      scenario: 'gone',
      code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND,
      reason: 'This invite no longer exists.',
    },
    {
      scenario: 'refused for another reason',
      code: ErrorCodes.INTERNAL,
      reason: 'The invite was not accepted.',
    },
  ])(
    'says why an invite that is $scenario was not accepted, and drops it',
    async ({ code, reason }) => {
      const { user } = await renderTeam('/invites', {
        state: { myInvites: [myInvite('editor')] },
        answerFailure: code,
      });

      await user.click(
        await screen.findByRole('button', { name: 'Accept the invite to Other Show' })
      );

      expect(await screen.findByText(reason)).toBeInTheDocument();
      expect(await screen.findByText('No invites')).toBeInTheDocument();
    }
  );

  it('says a failed decline was not declined', async () => {
    const { user } = await renderTeam('/invites', {
      state: { myInvites: [myInvite('editor')] },
      answerFailure: ErrorCodes.INTERNAL,
    });

    await user.click(
      await screen.findByRole('button', { name: 'Decline the invite to Other Show' })
    );

    expect(await screen.findByText('The invite was not declined.')).toBeInTheDocument();
  });

  it('describes the role the invite offers', async () => {
    await renderTeam('/invites', { state: { myInvites: [myInvite('moderator')] } });

    const card = await screen.findByRole('listitem');

    expect(within(card).getByText('Keeps the comments in order.')).toBeInTheDocument();
  });
});

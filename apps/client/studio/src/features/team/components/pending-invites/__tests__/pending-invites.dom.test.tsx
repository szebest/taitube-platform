import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import {
  INVITE_ID,
  invite,
  membership,
  OTHER_CHANNEL_ID,
} from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: PendingInvites', () => {
  it('lists each invite with its role and expiry, and revokes one', async () => {
    const { user, requests } = await renderTeam('/team', {
      state: { invites: [invite('editor', 'Newcomer')] },
    });

    const table = await screen.findByRole('table', {
      name: 'Invites that nobody has answered yet',
    });
    expect(within(table).getByText('Editor')).toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'Revoke the invite for Newcomer' }));

    expect(await screen.findByText('Invite revoked')).toBeInTheDocument();
    expect(requests.revoked).toEqual([INVITE_ID]);
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('table', { name: 'Invites that nobody has answered yet' })
      ).toBeNull()
    );
  });

  it('shows nothing when no invite is waiting', async () => {
    await renderTeam();

    await screen.findByText('No one else yet');

    expect(screen.queryByText('Pending invites')).toBeNull();
  });

  it('gives a manager no way to revoke an invite to a manager', async () => {
    await renderTeam('/team', {
      state: { invites: [invite('manager', 'Newcomer')], memberships: [membership('manager')] },
      actingOn: OTHER_CHANNEL_ID,
    });

    await screen.findByText('Newcomer');

    expect(screen.queryByRole('button', { name: /Revoke the invite/ })).toBeNull();
  });
});

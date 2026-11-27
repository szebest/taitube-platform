import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import {
  EDITOR_ID,
  invite,
  MANAGER_ID,
  member,
  membership,
  MODERATOR_ID,
  OTHER_CHANNEL_ID,
  roleChanged,
} from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: TeamPage', () => {
  it('lists the members with their roles and the invites nobody has answered', async () => {
    await renderTeam('/team', {
      state: {
        members: [member(EDITOR_ID, 'editor', 'Eddie'), member(MODERATOR_ID, 'moderator', 'Modo')],
        invites: [invite('analytics', 'Newcomer')],
      },
    });

    const members = await screen.findByRole('table', {
      name: 'The people who work on this channel',
    });
    const invites = screen.getByRole('table', { name: 'Invites that nobody has answered yet' });

    expect(within(members).getByText('Eddie')).toBeInTheDocument();
    expect(within(members).getByRole('combobox', { name: 'Role of Eddie' })).toHaveTextContent(
      'Editor'
    );
    expect(within(invites).getByText('Newcomer')).toBeInTheDocument();
    expect(within(invites).getByText('Analytics viewer')).toBeInTheDocument();
  });

  it('shows what a team without members can do next', async () => {
    await renderTeam();

    expect(await screen.findByText('No one else yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Invite someone' }).length).toBeGreaterThan(0);
  });

  it('opens the audit log as the second tab and says so in the address', async () => {
    const { user, router } = await renderTeam('/team', {
      state: { auditPages: [[roleChanged('0190c3a0-5e1d-7000-8000-0000000ee001')]] },
    });

    await user.click(screen.getByRole('tab', { name: 'Audit log' }));

    expect(await screen.findByText('Changed a role')).toBeInTheDocument();
    expect(router.state.location.searchStr).toBe('?tab=audit');
  });

  it('tells a member who cannot manage the team so, and asks the API nothing about it', async () => {
    const { requests } = await renderTeam('/team', {
      state: { memberships: [membership('editor')] },
      actingOn: OTHER_CHANNEL_ID,
    });

    expect(await screen.findByText('Only managers see the team')).toBeInTheDocument();
    expect(requests.teamChannels).toEqual([]);
  });

  it('asks about the channel the studio acts on', async () => {
    const { requests } = await renderTeam('/team', {
      state: {
        memberships: [membership('manager')],
        members: [member(MANAGER_ID, 'manager', 'Mia')],
      },
      actingOn: OTHER_CHANNEL_ID,
    });

    await screen.findByText('Mia');

    expect(requests.teamChannels).toEqual([OTHER_CHANNEL_ID]);
  });
});

import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import {
  EDITOR_ID,
  MANAGER_ID,
  member,
  membership,
  OTHER_CHANNEL_ID,
} from '#app/features/team/__tests__/team-api.fixture';

const team = [member(EDITOR_ID, 'editor', 'Eddie'), member(MANAGER_ID, 'manager', 'Mia')];

describe('apps/client/studio: MemberRoleCell', () => {
  it('changes a role through the select and shows the new one', async () => {
    const { user, requests } = await renderTeam('/team', { state: { members: team } });

    await user.click(await screen.findByRole('combobox', { name: 'Role of Eddie' }));
    await user.click(await screen.findByRole('option', { name: 'Moderator' }));

    await vi.waitFor(() =>
      expect(requests.changes).toEqual([{ userId: EDITOR_ID, role: 'moderator' }])
    );
    await vi.waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Role of Eddie' })).toHaveTextContent('Moderator')
    );
  });

  it('leaves a manager to the owner: a manager sees the role of another manager as a label and may not give it', async () => {
    const { user } = await renderTeam('/team', {
      state: { members: team, memberships: [membership('manager')] },
      actingOn: OTHER_CHANNEL_ID,
    });

    await screen.findByText('Mia');

    expect(screen.queryByRole('combobox', { name: 'Role of Mia' })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'Role of Eddie' }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Editor',
      'Moderator',
      'Analytics viewer',
    ]);
  });
});

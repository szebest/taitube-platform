import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import {
  EDITOR_ID,
  MANAGER_ID,
  member,
  membership,
  OTHER_CHANNEL_ID,
} from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: RemoveMemberDialog', () => {
  it('asks first, then removes the member and drops the row', async () => {
    const { user, requests } = await renderTeam('/team', {
      state: { members: [member(EDITOR_ID, 'editor', 'Eddie')] },
    });

    await user.click(await screen.findByRole('button', { name: 'Remove Eddie' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Eddie from the team?' });
    expect(requests.removed).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Eddie was removed')).toBeInTheDocument();
    expect(requests.removed).toEqual([EDITOR_ID]);
    await vi.waitFor(() => expect(screen.queryByText('@eddie')).toBeNull());
  });

  it('keeps the member when the owner thinks again', async () => {
    const { user, requests } = await renderTeam('/team', {
      state: { members: [member(EDITOR_ID, 'editor', 'Eddie')] },
    });

    await user.click(await screen.findByRole('button', { name: 'Remove Eddie' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' })
    );

    expect(requests.removed).toEqual([]);
    expect(screen.getByText('@eddie')).toBeInTheDocument();
  });

  it('offers a manager no way to remove another manager', async () => {
    await renderTeam('/team', {
      state: {
        members: [member(MANAGER_ID, 'manager', 'Mia'), member(EDITOR_ID, 'editor', 'Eddie')],
        memberships: [membership('manager')],
      },
      actingOn: OTHER_CHANNEL_ID,
    });

    await screen.findByText('Mia');

    expect(screen.queryByRole('button', { name: 'Remove Mia' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Eddie' })).toBeInTheDocument();
  });
});

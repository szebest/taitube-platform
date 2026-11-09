import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';

describe('apps/client/studio: RoleCapabilities', () => {
  it.each([
    {
      role: 'Manager',
      can: [
        'Invite people, change roles and read the audit log',
        'Moderate comments',
        'Delete videos',
      ],
    },
    { role: 'Editor', can: ['Upload and edit videos, thumbnails and visibility'] },
    { role: 'Moderator', can: ['Moderate comments', 'Pin comments'] },
    { role: 'Analytics viewer', can: ['Read analytics and exports'] },
  ])('lists what a $role can do, and never the ownership of the channel', async ({ role, can }) => {
    const { user } = await renderTeam();
    await user.click(
      (await screen.findAllByRole('button', { name: 'Invite someone' }))[0] as HTMLElement
    );
    const dialog = await screen.findByRole('dialog', { name: 'Invite to the team' });

    await user.click(within(dialog).getByRole('radio', { name: role }));

    const callout = within(dialog).getByRole('status');
    for (const capability of can) expect(within(callout).getByText(capability)).toBeInTheDocument();
    expect(within(callout).queryByText('Delete the channel and transfer ownership')).toBeNull();
  });

  it('gives a role that cannot edit nothing to edit with', async () => {
    const { user } = await renderTeam();
    await user.click(
      (await screen.findAllByRole('button', { name: 'Invite someone' }))[0] as HTMLElement
    );
    const dialog = await screen.findByRole('dialog', { name: 'Invite to the team' });

    await user.click(within(dialog).getByRole('radio', { name: 'Moderator' }));

    expect(
      within(within(dialog).getByRole('status')).queryByText(/Upload and edit videos/)
    ).toBeNull();
  });
});

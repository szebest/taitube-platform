import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { EDITOR_ID, member, MODERATOR_ID } from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: MembersPanel', () => {
  it('names each member with their handle and when they joined', async () => {
    await renderTeam('/team', { state: { members: [member(EDITOR_ID, 'editor', 'Eddie')] } });

    const row = (await screen.findByText('@eddie')).closest('tr') as HTMLElement;

    expect(within(row).getByText('Eddie')).toBeInTheDocument();
    expect(within(row).getByText(/ago/)).toHaveAttribute('datetime');
  });

  it('names a member whose channel is gone as an unknown channel, and still lets the owner remove them', async () => {
    await renderTeam('/team', {
      state: { members: [{ ...member(MODERATOR_ID, 'moderator', 'Modo'), profile: null }] },
    });

    expect(await screen.findByText('Unknown channel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Unknown channel' })).toBeInTheDocument();
  });

  it('opens the invite dialog from the toolbar', async () => {
    const { user } = await renderTeam('/team', {
      state: { members: [member(EDITOR_ID, 'editor', 'Eddie')] },
    });

    await user.click(await screen.findByRole('button', { name: 'Invite someone' }));

    expect(await screen.findByRole('dialog', { name: 'Invite to the team' })).toBeInTheDocument();
  });
});

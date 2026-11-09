import { screen } from '@testing-library/react';
import type { ChannelRole } from '@vp/domain';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: LeaveTeamItem', () => {
  it.each<ChannelRole>(['manager', 'editor', 'moderator', 'analytics'])(
    'offers a %s a way to leave the team',
    async (role) => {
      const { user } = await renderTeam('/team', {
        state: { memberships: [membership(role)] },
        actingOn: OTHER_CHANNEL_ID,
      });

      await user.click(screen.getByRole('button', { name: 'Switch channel' }));

      expect(await screen.findByRole('menuitem', { name: 'Leave this team' })).toBeInTheDocument();
    }
  );

  it('offers the owner of the channel no way to leave it', async () => {
    const { user } = await renderTeam('/team', { state: { memberships: [membership('editor')] } });

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await screen.findByRole('menu');

    expect(screen.queryByRole('menuitem', { name: 'Leave this team' })).toBeNull();
  });
});

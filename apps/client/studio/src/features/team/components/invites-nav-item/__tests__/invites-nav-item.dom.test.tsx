import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { myInvite } from '#app/features/team/__tests__/team-api.fixture';

const nav = () => within(screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement);

describe('apps/client/studio: InvitesNavItem', () => {
  it('is absent while no invite waits', async () => {
    await renderTeam();

    expect(nav().queryByRole('link', { name: /Invites/ })).toBeNull();
  });

  it('shows how many invites wait, and goes to them', async () => {
    const { user, router } = await renderTeam('/team', {
      state: {
        myInvites: [
          myInvite('editor'),
          myInvite('analytics', { id: '0190c3a0-5e1d-7000-8000-0000000dd003' }),
        ],
      },
    });

    const link = await nav().findByRole('link', { name: /Invites/ });
    expect(link).toHaveTextContent('2');

    await user.click(link);

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/invites'));
    await vi.waitFor(() => expect(router.state.status).toBe('idle'));
  });
});

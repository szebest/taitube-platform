import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { serveLibrary } from '#app/__tests__/library-api.fixture';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { MY_INVITE_ID, myInvite } from '#app/features/team/__tests__/team-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: /invites', () => {
  it('sends a guest to the studio sign-in, back to the invites once signed in', async () => {
    const { router } = await renderRoute(getRouter, '/invites');

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toMatchObject({ redirect: '/invites' });
  });

  it('opens on the invite a notification names', async () => {
    await renderTeam(`/invites?invite=${MY_INVITE_ID}`, {
      state: { myInvites: [myInvite('editor')] },
    });

    expect(await screen.findByRole('listitem')).toHaveAttribute('aria-current', 'true');
  });

  it('takes an invitee from the invite to the channel they joined: accept, switch, leave', async () => {
    serveLibrary([{ cursor: null, items: [], next: null }]);
    const { user, router } = await renderTeam('/invites', {
      state: { myInvites: [myInvite('manager')] },
    });

    await user.click(
      await screen.findByRole('button', { name: 'Accept the invite to Other Show' })
    );
    await user.click(await screen.findByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Other Show/ }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/videos'));

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Leave this team' }));
    await user.click(await screen.findByRole('button', { name: 'Leave team' }));

    expect(await screen.findByText('You left Other Show')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Switch channel' })).toBeNull()
    );
  });
});

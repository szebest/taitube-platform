import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { getRouter } from '#app/router';

describe('apps/client/studio: /team', () => {
  it('sends a guest to the studio sign-in, back to the team once signed in', async () => {
    const { router } = await renderRoute(getRouter, '/team');

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toMatchObject({ redirect: '/team' });
  });

  it('opens on the members when the address names no tab, or one that is not', async () => {
    const { router } = await renderTeam('/team?tab=nope');

    expect(await screen.findByRole('tab', { name: 'Members' })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(router.state.location.pathname).toBe('/team');
  });

  it('opens the audit log on its tab from a shared address', async () => {
    await renderTeam('/team?tab=audit');

    expect(await screen.findByRole('tab', { name: 'Audit log' })).toHaveAttribute(
      'data-state',
      'active'
    );
  });
});

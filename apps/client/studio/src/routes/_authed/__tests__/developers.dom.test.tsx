import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';
import { getRouter } from '#app/router';

describe('apps/client/studio: /developers', () => {
  it('sends a guest to the studio sign-in, back to the page once signed in', async () => {
    const { router } = await renderRoute(getRouter, '/developers');

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toMatchObject({ redirect: '/developers' });
  });

  it('opens from the navigation, marked as the page shown', async () => {
    await renderDevelopers();

    const nav = screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;
    expect(within(nav).getByRole('link', { name: 'Developers' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});

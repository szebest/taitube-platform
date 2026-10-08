import { screen } from '@testing-library/react';

import { loaderApi } from '#app/__tests__/loader-api';
import { renderRoute } from '#app/__tests__/render-route';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '#app/config';

afterEach(() => window.localStorage.clear());

describe('apps/web: /subscriptions in the browser', () => {
  it("loads the viewer's subscriptions in the loader", async () => {
    window.localStorage.setItem(AUTH_TOKEN_LOCAL_STORAGE_KEY, 'signed-in');
    const answered: string[] = [];

    await renderRoute('/subscriptions', { handlers: loaderApi(answered) });

    expect(await screen.findByText('Your subsciptions:')).toBeInTheDocument();
    expect(answered).toContain('/v1/me/subscriptions');
  });

  it('sends a guest home without asking for members-only data', async () => {
    const answered: string[] = [];

    const { router } = await renderRoute('/subscriptions', { handlers: loaderApi(answered) });

    expect(await screen.findByText('All videos:')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(answered).not.toContain('/v1/me/subscriptions');
  });
});

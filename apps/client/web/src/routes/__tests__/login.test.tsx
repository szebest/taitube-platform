import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: /login', () => {
  it('offers a guest the dev personas while the dev server runs', async () => {
    const { status, html } = await serverRender(getRouter, '/login?redirect=%2Fsubscriptions', {
      handlers: loaderApi(),
    });

    expect(status).toBe(200);
    expect(html).toContain('<title>Sign in - Taitube</title>');
    expect(html).toContain('Sign in as a dev persona');
  });

  it.each([
    { asked: '/subscriptions', location: '/subscriptions' },
    { asked: 'https://evil.example/', location: '/login' },
  ])(
    'sends a signed-in viewer asked back to $asked to $location, never off this origin',
    async ({ asked, location }) => {
      const rendered = await serverRender(
        getRouter,
        `/login?redirect=${encodeURIComponent(asked)}`,
        {
          handlers: loaderApi(),
          headers: { cookie: SESSION },
        }
      );

      expect(rendered.status).toBe(307);
      expect(rendered.location).toBe(location);
    }
  );
});

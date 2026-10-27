import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: login page', () => {
  it.each([
    { url: '/login', status: null },
    { url: '/login?reason=expired', status: 'Your session ended. Sign in again to carry on.' },
  ])('says why the viewer is here at $url', async ({ url, status }) => {
    await renderRoute(getRouter, url, { handlers: loaderApi() });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByRole('status')?.textContent ?? null).toBe(status);
  });
});

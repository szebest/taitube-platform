import { screen } from '@testing-library/react';
import { DEV_TOKEN_URL } from '@vp/queries/dev-personas';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse, http } from 'msw/http';

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

  it('shows a failed sign-in in the alert and moves focus to it', async () => {
    const devToken = http.get(
      `${DEV_TOKEN_URL}/token`,
      () => new HttpResponse(null, { status: 404 })
    );
    const { user } = await renderRoute(getRouter, '/login', {
      handlers: [...loaderApi(), devToken],
    });

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Is pnpm dev running dev-token serve?');
    expect(alert).toHaveFocus();
  });
});

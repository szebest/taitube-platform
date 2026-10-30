import { screen } from '@testing-library/react';
import { DEV_TOKEN_URL } from '@vp/queries/dev-personas';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse, http } from 'msw/http';

import { getRouter } from '#app/router';

describe('apps/client/studio: login page', () => {
  it('shows a failed sign-in in the alert and moves focus to it', async () => {
    const devToken = http.get(
      `${DEV_TOKEN_URL}/token`,
      () => new HttpResponse(null, { status: 404 })
    );
    const { user } = await renderRoute(getRouter, '/login', { handlers: [devToken] });

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Is pnpm dev running dev-token serve?');
    expect(alert).toHaveFocus();
  });
});

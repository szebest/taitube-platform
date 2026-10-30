import { screen } from '@testing-library/react';
import { listMySubscriptions } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { api, mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { devTokenServe, signInBrowser } from '#app/__tests__/providers';
import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { getRouter } from '#app/router';

describe('apps/client/web: /subscriptions in the browser', () => {
  it("loads the viewer's subscriptions in the loader", async () => {
    const answered: string[] = [];

    const { queryClient } = await renderRoute(getRouter, '/subscriptions', {
      handlers: [signInBrowser(), ...loaderApi(answered)],
    });

    expect(queryClient.getQueryState(mySubscriptionsQueryOptions(api).queryKey)?.status).toBe(
      'success'
    );
    expect(await screen.findByRole('heading', { name: 'Your subscriptions' })).toBeInTheDocument();
    expect(answered).toContain('/v1/me/subscriptions');
  });

  it('sends a guest to sign in, and back to /subscriptions once they have', async () => {
    const answered: string[] = [];

    const { router, user } = await renderRoute(getRouter, '/subscriptions', {
      handlers: [devTokenServe(), ...loaderApi(answered)],
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Fsubscriptions');
    expect(answered).not.toContain('/v1/me/subscriptions');

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    expect(await screen.findByRole('heading', { name: 'Your subscriptions' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/subscriptions');
  });

  it('sends a viewer whose session the API refuses to sign in again, with no reload', async () => {
    const expired = mockEndpoint(listMySubscriptions, () => problemReply(ErrorCodes.UNAUTHORIZED));

    const { router } = await renderRoute(getRouter, '/subscriptions', {
      handlers: [expired, signInBrowser(), ...loaderApi()],
    });

    await vi.waitFor(() =>
      expect(router.state.location.href).toBe('/login?redirect=%2Fsubscriptions&reason=expired')
    );
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

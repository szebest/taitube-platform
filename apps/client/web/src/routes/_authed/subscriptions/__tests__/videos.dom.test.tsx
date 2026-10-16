import { screen } from '@testing-library/react';
import { api } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { getRouter } from '#app/router';

describe('apps/client/web: /subscriptions/videos in the browser', () => {
  it('loads the subscription feed in the loader', async () => {
    const answered: string[] = [];

    const { queryClient } = await renderRoute(getRouter, '/subscriptions/videos', {
      handlers: [signInBrowser(), ...loaderApi(answered)],
    });

    expect(queryClient.getQueryState(subscriptionFeedQueryOptions(api).queryKey)?.status).toBe(
      'success'
    );
    expect(await screen.findByText('Feed video')).toBeInTheDocument();
    expect(answered).toContain('/v1/feed/subscriptions');
  });

  it('sends a guest to sign in without asking for members-only data', async () => {
    const answered: string[] = [];

    const { router } = await renderRoute(getRouter, '/subscriptions/videos', {
      handlers: loaderApi(answered),
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Fsubscriptions%2Fvideos');
    expect(answered).not.toContain('/v1/feed/subscriptions');
  });
});

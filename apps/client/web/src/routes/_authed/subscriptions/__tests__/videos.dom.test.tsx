import { screen } from '@testing-library/react';

import { loaderApi } from '#app/__tests__/loader-api';
import { renderRoute } from '#app/__tests__/render-route';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '#app/config';
import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';

afterEach(() => window.localStorage.clear());

describe('apps/client/web: /subscriptions/videos in the browser', () => {
  it('loads the subscription feed in the loader', async () => {
    window.localStorage.setItem(AUTH_TOKEN_LOCAL_STORAGE_KEY, 'signed-in');
    const answered: string[] = [];

    const { queryClient } = await renderRoute('/subscriptions/videos', {
      handlers: loaderApi(answered),
    });

    expect(queryClient.getQueryState(subscriptionFeedQueryOptions().queryKey)?.status).toBe(
      'success'
    );

    expect(await screen.findByText('Feed video')).toBeInTheDocument();
    expect(answered).toContain('/v1/feed/subscriptions');
  });

  it('sends a guest home without asking for members-only data', async () => {
    const answered: string[] = [];

    const { router } = await renderRoute('/subscriptions/videos', {
      handlers: loaderApi(answered),
    });

    expect(await screen.findByText('All videos:')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(answered).not.toContain('/v1/feed/subscriptions');
  });
});

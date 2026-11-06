import { screen } from '@testing-library/react';
import { isSubscribedToChannel } from '@vp/api-contracts';
import { CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const URL = `/channel/${CHANNEL_ID}`;

function renderChannelAs(subscribed: boolean | 'guest') {
  const handlers =
    subscribed === 'guest'
      ? []
      : [
          signInBrowser(),
          mockEndpoint(isSubscribedToChannel, () =>
            HttpResponse.json({ channelId: CHANNEL_ID, subscribed })
          ),
        ];

  return renderRoute(getRouter, URL, { handlers: [...handlers, ...loaderApi()] });
}

describe('apps/client/web: SubscribeAction', () => {
  it('sends a guest who presses Subscribe to sign in, then back to the page', async () => {
    const { user, router } = await renderChannelAs('guest');

    await user.click(await screen.findByRole('button', { name: 'Subscribe' }));

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: URL });
  });

  it.each([
    { subscribed: true, name: 'Subscribed' },
    { subscribed: false, name: 'Subscribe' },
  ])(
    'reads $name for a signed-in viewer whose status is $subscribed',
    async ({ subscribed, name }) => {
      await renderChannelAs(subscribed);

      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
  );
});

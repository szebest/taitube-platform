import { getSubscriptionFeed } from '@vp/api-contracts';
import { mockEndpoint, videoSummary } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: members-only layout', () => {
  it('sends a guest to sign in from the server, before any page renders', async () => {
    const { status, location } = await serverRender(getRouter, '/subscriptions/videos', {
      handlers: loaderApi(),
    });

    expect(status).toBe(307);
    expect(location).toBe('/login?redirect=%2Fsubscriptions%2Fvideos');
  });

  it('renders the page on the server for a signed-in viewer, its loader calling the API as them', async () => {
    const sent: (string | null)[] = [];
    const feed = mockEndpoint(getSubscriptionFeed, ({ request }) => {
      sent.push(request.headers.get('authorization'));
      return HttpResponse.json({
        items: [videoSummary({ title: 'From my subscriptions' })],
        nextCursor: null,
        total: 1,
      });
    });

    const { status, main } = await serverRender(getRouter, '/subscriptions/videos', {
      handlers: [feed, ...loaderApi()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(200);
    expect(main).toContain('From my subscriptions');
    expect(sent).toEqual(['Bearer signed-in']);
  });
});

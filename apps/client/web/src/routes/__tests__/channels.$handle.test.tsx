import { getChannel, listMyMemberships } from '@vp/api-contracts';
import { CHANNEL_ID, channel, mockEndpoint } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import {
  channelPageApi,
  channelPageView,
  contentSection,
  tabSummary,
} from '#app/__tests__/channel-page-fixtures';
import { loaderApi } from '#app/__tests__/loader-api';
import { SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const SERIES_TAB = tabSummary({ id: 'series', kind: 'custom', title: 'Series', slug: 'series' });
const HOME_TAB = tabSummary();

const asSubscriber = (authorization: string | null) =>
  authorization === null
    ? channelPageView(
        { ...HOME_TAB, sections: [contentSection({ id: 'new' })] },
        {
          landing: 'home',
          tabs: [HOME_TAB, SERIES_TAB],
        }
      )
    : channelPageView(
        { ...SERIES_TAB, description: 'Every episode', sections: [] },
        {
          landing: 'series',
          tabs: [HOME_TAB, SERIES_TAB],
        }
      );

const handlers = (asked: string[] = []) => [
  mockEndpoint(getChannel, () => HttpResponse.json(channel())),
  mockEndpoint(listMyMemberships, () => HttpResponse.json({ items: [] })),
  ...channelPageApi((_query, authorization) => asSubscriber(authorization), asked),
  ...loaderApi(),
];

describe('apps/client/web: /channels/$handle', () => {
  it('opens the tab the API picked as this viewer landing, asking without a tab, and links every tab it lists', async () => {
    const guest = await serverRender(getRouter, '/channels/creator', { handlers: handlers() });
    const subscriber = await serverRender(getRouter, '/channels/creator', {
      handlers: handlers(),
      headers: { cookie: SESSION },
    });

    expect(guest.main).toContain('Season one');
    expect(guest.main).toContain('href="/channels/creator/series"');
    expect(subscriber.main).toContain('Every episode');
    expect(subscriber.main).not.toContain('Season one');
  });

  it('asks the public page, never the draft, when the address names no preview', async () => {
    const asked: string[] = [];

    await serverRender(getRouter, '/channels/creator', { handlers: handlers(asked) });

    expect(asked).toEqual([`/v1/channels/${CHANNEL_ID}/page?locale=en`]);
  });

  it.each([
    {
      scenario: 'a guest',
      headers: undefined,
      expected: `/v1/channels/${CHANNEL_ID}/page?locale=en`,
      banner: false,
    },
    {
      scenario: 'the signed-in editor of this channel',
      headers: { cookie: SESSION },
      expected: '/v1/me/channel/page/preview?as=subscriber&locale=en',
      banner: true,
    },
  ])('answers $expected for $scenario who asks for the draft as a subscriber', async (scenario) => {
    const asked: string[] = [];

    const { main } = await serverRender(
      getRouter,
      '/channels/creator?preview=draft&as=subscriber',
      {
        handlers: handlers(asked),
        headers: scenario.headers,
      }
    );

    expect(asked).toEqual([scenario.expected]);
    expect(main.includes('Previewing the draft as a subscriber')).toBe(scenario.banner);
  });

  it('answers 301 to the new handle for a retired one', async () => {
    const { status, location } = await serverRender(getRouter, '/channels/old-name', {
      handlers: [
        mockEndpoint(getChannel, () =>
          HttpResponse.json(channel({ handle: 'new-name', redirectedFrom: 'old-name' }))
        ),
        ...loaderApi(),
      ],
    });

    expect(status).toBe(301);
    expect(location).toBe('/channels/new-name');
  });
});

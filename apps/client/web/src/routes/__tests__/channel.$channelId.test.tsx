import { getChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, problemReply } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { loaderApi } from '#app/__tests__/loader-api';
import { mockEndpoint } from '@vp/web-testing';
import { getRouter } from '#app/router';
import { headOf, jsonLdOf } from '#app/__tests__/head-tags';

describe('apps/client/web: /channel/$channelId', () => {
  it('server-renders the channel the loader fetched', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender(getRouter, `/channel/${CHANNEL_ID}`, {
      handlers: loaderApi(answered),
    });

    expect(status).toBe(200);
    expect(main).toContain('The Creator');
    expect(answered).toEqual([`/v1/channels/${CHANNEL_ID}`, `/v1/channels/${CHANNEL_ID}/videos`]);
  });

  it('server-renders its title, description, canonical URL and an ItemList of its videos', async () => {
    const { html } = await serverRender(getRouter, `/channel/${CHANNEL_ID}`, {
      handlers: loaderApi(),
    });

    const head = headOf(html);
    expect(head).toContain('<title>The Creator</title>');
    expect(head).toContain('<meta property="og:type" content="profile"/>');
    expect(head).toContain(
      `<link rel="canonical" href="http://localhost:5173/channel/${CHANNEL_ID}"/>`
    );
    expect(jsonLdOf(html)).toMatchObject([
      {
        '@type': 'ItemList',
        itemListElement: [{ item: { '@type': 'VideoObject', name: 'Feed video' } }],
      },
    ]);
  });

  it('renders not-found for a segment that is not a channel id, without asking the API', async () => {
    const answered: string[] = [];

    const { status } = await serverRender(getRouter, '/channel/not-a-channel', {
      handlers: loaderApi(answered),
    });

    expect(status).toBe(404);
    expect(answered).toEqual([]);
  });

  it('renders not-found when the API has no such channel', async () => {
    const { status, html } = await serverRender(getRouter, `/channel/${CHANNEL_ID}`, {
      handlers: [mockEndpoint(getChannel, () => problemReply(ErrorCodes.CHANNEL_NOT_FOUND))],
    });

    expect(status).toBe(404);
    expect(html).toContain('This page does not exist.');
    expect(headOf(html)).not.toContain('og:');
  });
});

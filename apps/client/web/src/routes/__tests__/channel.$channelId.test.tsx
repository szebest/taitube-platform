import { getChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, mockEndpoint, problemReply } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /channel/$channelId', () => {
  it('server-renders the channel the loader fetched', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender(getRouter, `/channel/${CHANNEL_ID}`, {
      handlers: loaderApi(answered),
    });

    expect(status).toBe(200);
    expect(main).toContain('The Creator');
    expect(answered).toEqual([`/v1/channels/${CHANNEL_ID}`]);
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
  });
});

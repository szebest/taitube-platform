import { getChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, channel, mockEndpoint, problemReply } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { headOf } from '#app/__tests__/head-tags';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const byHandle = (fields: Parameters<typeof channel>[0]) =>
  mockEndpoint(getChannel, () => HttpResponse.json(channel(fields)));

describe('apps/client/web: /@handle', () => {
  it('server-renders the channel the handle names, asking the API by handle', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender(getRouter, '/@creator', {
      handlers: [
        mockEndpoint(getChannel, ({ request }) => {
          answered.push(new URL(request.url).pathname);
          return HttpResponse.json(channel());
        }),
        ...loaderApi(answered),
      ],
    });

    expect(status).toBe(200);
    expect(main).toContain('The Creator');
    expect(answered).toContain('/v1/channels/creator');
    expect(answered).toContain(`/v1/channels/${CHANNEL_ID}/featured`);
  });

  it('points its canonical URL at the current handle', async () => {
    const { html } = await serverRender(getRouter, '/@creator', {
      handlers: [byHandle({}), ...loaderApi()],
    });

    expect(headOf(html)).toContain('<link rel="canonical" href="http://localhost:5173/@creator">');
  });

  it('answers 301 to the new handle for a retired one, without rendering the page', async () => {
    const { status, location } = await serverRender(getRouter, '/@old-name', {
      handlers: [byHandle({ handle: 'new-name', redirectedFrom: 'old-name' }), ...loaderApi()],
    });

    expect(status).toBe(301);
    expect(location).toBe('/@new-name');
  });

  it('renders not-found when no channel ever had the handle', async () => {
    const { status } = await serverRender(getRouter, '/@nobody', {
      handlers: [mockEndpoint(getChannel, () => problemReply(ErrorCodes.CHANNEL_NOT_FOUND))],
    });

    expect(status).toBe(404);
  });
});

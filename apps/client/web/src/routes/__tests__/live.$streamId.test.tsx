import { getLiveStream } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { LIVE_STREAM_ID, liveStream, mockEndpoint, problemReply } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /live/$streamId', () => {
  it('server-renders the broadcast the loader fetched, titled for search and sharing', async () => {
    const asked: string[] = [];

    const { status, main, html } = await serverRender(getRouter, `/live/${LIVE_STREAM_ID}`, {
      handlers: [
        mockEndpoint(getLiveStream, ({ params }) => {
          asked.push(String(params.id));
          return HttpResponse.json(liveStream());
        }),
        ...loaderApi(),
      ],
    });

    expect(status).toBe(200);
    expect(asked).toEqual([LIVE_STREAM_ID]);
    expect(main).toContain('>Lisbon trams at dusk</h1>');
    expect(html).toContain('<title>Lisbon trams at dusk');
  });

  it.each([
    { scenario: 'a stream the API does not find', path: `/live/${LIVE_STREAM_ID}` },
    { scenario: 'an id that is not a stream id', path: '/live/not-an-id' },
  ])('renders not found for $scenario', async ({ path }) => {
    const { status } = await serverRender(getRouter, path, {
      handlers: [
        mockEndpoint(getLiveStream, () => problemReply(ErrorCodes.LIVE_STREAM_NOT_FOUND)),
        ...loaderApi(),
      ],
    });

    expect(status).toBe(404);
  });
});

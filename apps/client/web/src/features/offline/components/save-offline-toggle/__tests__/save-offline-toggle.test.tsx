import { getVideo } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: SaveOfflineToggle on the server', () => {
  it('renders the action disabled, so the engagement bar does not wrap again once the browser is known', async () => {
    const { main } = await serverRender(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [
        mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' }))),
        ...loaderApi(),
      ],
    });

    expect(main).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Save for offline/s);
  });
});

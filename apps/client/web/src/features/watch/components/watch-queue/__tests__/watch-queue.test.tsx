import { getVideo } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const render = () =>
  serverRender(getRouter, `/watch/${VIDEO_ID}`, {
    handlers: [
      mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' }))),
      ...loaderApi(),
    ],
  });

describe('apps/client/web: watch queue on the server', () => {
  it('renders the video on the page as the queue first row, so hydration does not swap it in', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('Now playing');
    expect(main).toContain('1 / 1');
    expect(main).not.toContain('Nothing queued');
  });
});

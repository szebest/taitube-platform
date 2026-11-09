import { getVideo } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { getRouter } from '#app/router';

describe('apps/client/web: embed layout', () => {
  it('frames the page with the API client and none of the app shell', async () => {
    const { html } = await serverRender(getRouter, `/embed/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' })))],
    });

    expect(html).not.toContain('<header');
    expect(html).not.toContain('data-slot="app-shell"');
  });
});

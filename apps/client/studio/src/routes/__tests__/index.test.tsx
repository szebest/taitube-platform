import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

describe('apps/client/studio: /', () => {
  it('sends the creator to the upload page', async () => {
    const rendered = await serverRender(getRouter, '/');

    expect(rendered.status).toBe(307);
    expect(rendered.location).toBe('/upload');
  });
});

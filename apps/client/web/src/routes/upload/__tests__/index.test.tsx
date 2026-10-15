import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

describe('apps/client/web: /upload', () => {
  it('sends the creator to the upload page of the studio', async () => {
    const rendered = await serverRender(getRouter, '/upload');

    expect(rendered.status).toBe(307);
    expect(rendered.location).toBe('http://localhost:5174/upload');
  });
});

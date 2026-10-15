import { serverRender } from '@vp/web-testing';

import { getRouter } from '#app/router';

describe('apps/client/web: /upload', () => {
  it('narrows the layout to the upload form width', async () => {
    const { status, main } = await serverRender(getRouter, '/upload');

    expect(status).toBe(200);
    expect(main).toContain('max-width:1280px');
  });
});

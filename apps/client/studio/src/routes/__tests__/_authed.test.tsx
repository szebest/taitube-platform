import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

describe('apps/client/studio: members-only layout', () => {
  it('keeps the page area empty on the server, whose render cannot see the token', async () => {
    const { status, main } = await serverRender(getRouter, '/upload');

    expect(status).toBe(200);
    expect(main).toContain('<main');
    expect(main).not.toContain('Video title');
    expect(main).not.toContain('dev token');
  });
});

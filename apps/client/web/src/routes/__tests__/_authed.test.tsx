import { serverRender } from '@vp/web-testing';

import { getRouter } from '#app/router';

describe('apps/client/web: members-only layout', () => {
  it('keeps the page area empty for a guest, whose token the server cannot see', async () => {
    const { status, main } = await serverRender(getRouter, '/subscriptions/videos');

    expect(status).toBe(200);
    expect(main).toContain('<main>');
    expect(main).not.toContain('<h3>');
  });
});

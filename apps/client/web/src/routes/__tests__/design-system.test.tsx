import { serverRender } from '@vp/web-testing';

import { getRouter } from '#app/router';

describe('apps/client/web: /design-system', () => {
  it('server-renders the showcase on the dev server', async () => {
    const { status, html } = await serverRender(getRouter, '/design-system');

    expect(status).toBe(200);
    expect(html).toContain('<title>Design system - Taitube</title>');
  });
});

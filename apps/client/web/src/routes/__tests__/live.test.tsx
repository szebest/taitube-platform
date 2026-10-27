import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /live', () => {
  it('server-renders its empty state, with the way back to the home feed, and asks the API nothing', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender(getRouter, '/live', {
      handlers: loaderApi(answered),
    });

    expect(status).toBe(200);
    expect(main).toContain('>Nothing is live right now</h1>');
    expect(main).toMatch(/<a[^>]*href="\/"[^>]*>Browse videos<\/a>/);
    expect(answered).toEqual([]);
  });
});

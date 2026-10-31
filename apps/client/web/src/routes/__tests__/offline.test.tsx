import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /offline', () => {
  it('server-renders what the worker precaches, with the way home and no API call', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender(getRouter, '/offline', {
      handlers: loaderApi(answered),
    });

    expect(status).toBe(200);
    expect(main).toContain('>You are offline</h1>');
    expect(main).toMatch(/<a[^>]*href="\/"[^>]*>Go to Home<\/a>/);
    expect(answered).toEqual([]);
  });
});

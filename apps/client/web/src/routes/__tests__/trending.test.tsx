import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /trending', () => {
  it('server-renders the trending videos the loader fetched inside the layout', async () => {
    const { status, main } = await serverRender(getRouter, '/trending', { handlers: loaderApi() });

    expect(status).toBe(200);
    expect(main).toContain('Trending videos:');
    expect(main).toContain('Feed video');
  });
});

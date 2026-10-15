import { serverRender } from '@vp/web-testing';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /', () => {
  it('server-renders the newest videos the loader fetched inside the layout', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender(getRouter, '/', { handlers: loaderApi(answered) });

    expect(status).toBe(200);
    expect(main).toContain('All videos:');
    expect(main).toContain('Feed video');
    expect(answered.sort()).toEqual(['/v1/categories', '/v1/feed']);
  });
});

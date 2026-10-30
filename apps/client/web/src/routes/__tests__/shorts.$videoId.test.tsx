import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /shorts/$videoId', () => {
  it('server-renders the Short a link names, fetched when the feed does not hold it', async () => {
    const answered: string[] = [];
    const linked = '0190c3a0-5e1d-7000-8000-00000000f099';

    const { status, main } = await serverRender(getRouter, `/shorts/${linked}`, {
      handlers: loaderApi(answered),
    });

    expect(status).toBe(200);
    expect(main).toContain('Launch day');
    expect(answered).toEqual(['/v1/shorts', '/v1/videos/0190c3a0-5e1d-7000-8000-00000000f099']);
  });

  it('turns a malformed Short id into the not-found page', async () => {
    const { status } = await serverRender(getRouter, '/shorts/not-a-uuid', {
      handlers: loaderApi(),
    });

    expect(status).toBe(404);
  });
});

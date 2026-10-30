import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /', () => {
  it('server-renders the shelves the loader fetched, each under a heading and with its reason', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender(getRouter, '/', { handlers: loaderApi(answered) });

    expect(status).toBe(200);
    expect(main).toContain('>Continue watching</h2>');
    expect(main).toContain('>Because you watched Lisbon at night</h2>');
    expect(main).toContain('>Trending now</h2>');
    expect(main).toContain('Similar topics');
    expect(main).toMatch(/aria-valuenow="50"[^>]*role="progressbar"[^>]*aria-label="Watched"/);
    expect(answered).toEqual(['/v1/home']);
  });
});

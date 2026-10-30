import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const render = () => serverRender(getRouter, '/settings/language', { handlers: loaderApi() });

describe('apps/client/web: /settings/language', () => {
  it('server-renders the language section', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Language</h1>');
  });
});

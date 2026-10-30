import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const render = () => serverRender(getRouter, '/settings/accessibility', { handlers: loaderApi() });

describe('apps/client/web: /settings/accessibility', () => {
  it('server-renders the accessibility section', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Accessibility</h1>');
  });
});

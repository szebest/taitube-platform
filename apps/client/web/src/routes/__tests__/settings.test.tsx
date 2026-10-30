import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const render = () => serverRender(getRouter, '/settings', { handlers: loaderApi() });

describe('apps/client/web: /settings', () => {
  it('server-renders the navigation and the overview', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Settings</h1>');
    expect(main).toContain('aria-label="Settings sections"');
    expect(main).toMatch(/<a[^>]*href="\/settings\/privacy"[^>]*>/);
    expect(main).not.toMatch(/<a[^>]*href="\/settings\/appearance\/advanced"[^>]*>Fine/);
  });
});

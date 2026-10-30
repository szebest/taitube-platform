import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const render = () => serverRender(getRouter, '/settings', { handlers: loaderApi() });

describe('apps/client/web: /settings', () => {
  it('server-renders the overview with a card for each section', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Settings</h1>');
    expect(main).toMatch(/<a[^>]*href="\/settings\/playback"[^>]*>/);
    expect(main).not.toContain('Fine-tune the look');
  });
});

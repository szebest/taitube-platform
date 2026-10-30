import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const render = () =>
  serverRender(getRouter, '/settings/appearance/advanced', { handlers: loaderApi() });

describe('apps/client/web: /settings/appearance/advanced', () => {
  it('server-renders the fine-tune page, with the way back to appearance', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Fine-tune the look</h1>');
    expect(main).toMatch(
      /<a(?=[^>]*data-slot="settings-shell-back")[^>]*href="\/settings\/appearance"/
    );
  });
});

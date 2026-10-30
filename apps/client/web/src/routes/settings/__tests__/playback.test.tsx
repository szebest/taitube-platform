import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const render = () => serverRender(getRouter, '/settings/playback', { handlers: loaderApi() });

describe('apps/client/web: /settings/playback', () => {
  it('server-renders the playback section with its rows', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Playback</h1>');
    expect(main).toContain('Autoplay next');
  });
});

import { serverRender } from '@vp/web-testing/server';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /feed/playlists', () => {
  it('sends a guest to sign in from the server, back to the playlists after', async () => {
    const { status, location } = await serverRender(getRouter, '/feed/playlists', {
      handlers: loaderApi(),
    });

    expect(status).toBe(307);
    expect(location).toBe('/login?redirect=%2Ffeed%2Fplaylists');
  });
});

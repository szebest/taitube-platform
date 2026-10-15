import { routeTree } from '../routeTree.gen';
import { getRouter } from '../router';

describe('apps/client/web: generated route tree', () => {
  it('carries every file route under src/routes', () => {
    expect(getRouter().routeTree).toBe(routeTree);
    expect(Object.keys(getRouter().routesById).sort()).toEqual([
      '/',
      '/$',
      '/_authed',
      '/_authed/subscriptions/',
      '/_authed/subscriptions/videos',
      '/channel/$channelId',
      '/design-system',
      '/trending',
      '/upload/',
      '/upload/edit/$videoId',
      '/watch/$videoId',
      '__root__',
    ]);
  });
});

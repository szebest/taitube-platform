import { getRouter } from '../router';
import { routeTree } from '../routeTree.gen';

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
      '/feed/trending',
      '/live',
      '/login',
      '/search',
      '/shorts',
      '/upload/',
      '/upload/edit/$videoId',
      '/watch/$videoId',
      '__root__',
    ]);
  });
});

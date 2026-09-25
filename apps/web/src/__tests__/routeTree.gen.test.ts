import { routeTree } from '../routeTree.gen';
import { getRouter } from '../router';

describe('apps/web: generated route tree', () => {
  it('carries every file route under src/routes', () => {
    expect(getRouter().routeTree).toBe(routeTree);
    expect(Object.keys(getRouter().routesById).sort()).toEqual([
      '/',
      '/$',
      '/_authed',
      '/_authed/subscriptions/',
      '/_authed/subscriptions/videos',
      '/_authed/upload/',
      '/_authed/upload/edit/$videoId',
      '/channel/$channelId',
      '/trending',
      '/watch/$videoId',
      '__root__',
    ]);
  });
});

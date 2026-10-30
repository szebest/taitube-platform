import { getRouter } from '../router';
import { routeTree } from '../routeTree.gen';

describe('apps/client/studio: generated route tree', () => {
  it('carries every file route under src/routes', () => {
    expect(getRouter().routeTree).toBe(routeTree);
    expect(Object.keys(getRouter().routesById).sort()).toEqual([
      '/',
      '/_authed',
      '/_authed/upload/',
      '/_authed/upload/edit/$videoId',
      '/_authed/videos/',
      '/_authed/videos/$videoId/analytics',
      '/login',
      '__root__',
    ]);
  });
});

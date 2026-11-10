import { getRouter } from '../router';
import { routeTree } from '../routeTree.gen';

describe('apps/client/studio: generated route tree', () => {
  it('carries every file route under src/routes', () => {
    expect(getRouter().routeTree).toBe(routeTree);
    expect(Object.keys(getRouter().routesById).sort()).toEqual([
      '/',
      '/_authed',
      '/_authed/admin',
      '/_authed/admin/',
      '/_authed/admin/categories',
      '/_authed/admin/curation',
      '/_authed/admin/moderation',
      '/_authed/admin/queues',
      '/_authed/analytics',
      '/_authed/comments',
      '/_authed/customization',
      '/_authed/invites',
      '/_authed/live',
      '/_authed/team',
      '/_authed/upload/',
      '/_authed/upload/edit/$videoId',
      '/_authed/videos/',
      '/_authed/videos/$videoId/',
      '/_authed/videos/$videoId/analytics',
      '/_authed/videos/$videoId/edit',
      '/live/overlay/$token',
      '/login',
      '__root__',
    ]);
  });
});

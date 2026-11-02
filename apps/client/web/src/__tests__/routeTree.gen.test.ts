import { getRouter } from '../router';
import { routeTree } from '../routeTree.gen';

describe('apps/client/web: generated route tree', () => {
  it('carries every file route under src/routes', () => {
    expect(getRouter().routeTree).toBe(routeTree);
    expect(Object.keys(getRouter().routesById).sort()).toEqual([
      '/',
      '/$',
      '/_authed',
      '/_authed/clips',
      '/_authed/feed/history',
      '/_authed/feed/you',
      '/_authed/subscriptions/',
      '/_authed/subscriptions/videos',
      '/channel/$channelId',
      '/clip/$clipId',
    '/embed/$videoId',
      '/feed/trending',
      '/feeds/videos.xml',
      '/live',
      '/login',
      '/offline',
      '/search',
      '/settings',
      '/settings/',
      '/settings/accessibility',
      '/settings/appearance/',
      '/settings/appearance/advanced',
      '/settings/language',
      '/settings/notifications',
      '/settings/playback',
      '/settings/privacy',
      '/shorts',
      '/shorts/$videoId',
      '/sitemap.xml',
      '/upload/',
      '/upload/edit/$videoId',
      '/watch/$videoId',
      '__root__',
    ]);
  });
});

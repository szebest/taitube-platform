import type { AuthConfig } from '@vp/env-schema';
import { assertNever } from '@vp/result';
import type { FastifyPluginAsync } from 'fastify';
import { adminCategoriesRoutes } from './admin/categories';
import { adminDlqRoutes } from './admin/dlq';
import { adminQueuesRoutes } from './admin/queues';
import { adminVideosRoutes } from './admin/videos';
import { analyticsRoutes } from './analytics';
import { bootstrapRoutes } from './bootstrap';
import { categoriesRoutes } from './categories';
import { channelsRoutes } from './channels';
import { commentsRoutes } from './comments';
import { creatorVideosRoutes } from './creator-videos';
import { devJwksRoutes } from './dev-jwks';
import { eventsRoutes } from './events';
import { feedRoutes } from './feed';
import { healthRoutes } from './health';
import { meRoutes } from './me';
import { playlistsRoutes } from './playlists';
import { reactionsRoutes } from './reactions';
import { subscriptionsRoutes } from './subscriptions';
import { uploadsRoutes } from './uploads';
import { videosRoutes } from './videos';
import { viewsRoutes } from './views';
import { watchHistoryRoutes } from './watch-history';

const ROUTES: readonly FastifyPluginAsync[] = [
  healthRoutes,
  uploadsRoutes,
  videosRoutes,
  reactionsRoutes,
  viewsRoutes,
  analyticsRoutes,
  creatorVideosRoutes,
  commentsRoutes,
  feedRoutes,
  categoriesRoutes,
  bootstrapRoutes,
  adminCategoriesRoutes,
  adminVideosRoutes,
  meRoutes,
  playlistsRoutes,
  watchHistoryRoutes,
  channelsRoutes,
  subscriptionsRoutes,
  eventsRoutes,
  adminQueuesRoutes,
  adminDlqRoutes,
];

/** The dev key is derived from a committed seed, so its JWKS is served in dev mode and nowhere else. */
export function routesFor(auth: AuthConfig): readonly FastifyPluginAsync[] {
  switch (auth.type) {
    case 'dev':
      return [...ROUTES, devJwksRoutes];
    case 'jwks':
      return ROUTES;
    default:
      return assertNever(auth, 'auth.type');
  }
}

import type { AuthConfig } from '@vp/env-schema';
import { assertNever } from '@vp/result';
import type { FastifyPluginAsync } from 'fastify';
import { adminCategoriesRoutes } from './admin/categories';
import { adminDlqRoutes } from './admin/dlq';
import { adminQueuesRoutes } from './admin/queues';
import { adminReportsRoutes } from './admin/reports';
import { adminVideosRoutes } from './admin/videos';
import { analyticsRoutes } from './analytics';
import { bootstrapRoutes } from './bootstrap';
import { captionsRoutes } from './captions';
import { categoriesRoutes } from './categories';
import { channelsRoutes } from './channels';
import { commentsRoutes } from './comments';
import { commentReportsRoutes } from './comment-reports';
import { creatorCommentsRoutes } from './creator-comments';
import { creatorVideosRoutes } from './creator-videos';
import { devJwksRoutes } from './dev-jwks';
import { eventsRoutes } from './events';
import { feedRoutes } from './feed';
import { healthRoutes } from './health';
import { meRoutes } from './me';
import { playlistsRoutes } from './playlists';
import { preferencesRoutes } from './preferences';
import { reactionsRoutes } from './reactions';
import { recommendationsRoutes } from './recommendations';
import { searchRoutes } from './search';
import { subscriptionsRoutes } from './subscriptions';
import { telemetryRoutes } from './telemetry';
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
  telemetryRoutes,
  analyticsRoutes,
  creatorVideosRoutes,
  commentsRoutes,
  commentReportsRoutes,
  creatorCommentsRoutes,
  feedRoutes,
  recommendationsRoutes,
  searchRoutes,
  categoriesRoutes,
  bootstrapRoutes,
  adminCategoriesRoutes,
  adminVideosRoutes,
  meRoutes,
  preferencesRoutes,
  captionsRoutes,
  playlistsRoutes,
  watchHistoryRoutes,
  channelsRoutes,
  subscriptionsRoutes,
  eventsRoutes,
  adminQueuesRoutes,
  adminDlqRoutes,
  adminReportsRoutes,
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

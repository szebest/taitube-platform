import { PostgresContentLinkDismissalRepository } from './postgres-content-link-dismissal-repository';
import { PostgresContentLinkRepository } from './postgres-content-link-repository';
import { PostgresContentLinkStatsRepository } from './postgres-content-link-stats-repository';
import { PostgresVideoEndScreenRepository } from './postgres-video-end-screen-repository';
import type { PostgresDatabase } from './types';

export function createContentLinkRepositories(db: PostgresDatabase) {
  return {
    contentLinks: new PostgresContentLinkRepository(db),
    contentLinkDismissals: new PostgresContentLinkDismissalRepository(db),
    contentLinkStats: new PostgresContentLinkStatsRepository(db),
    videoEndScreens: new PostgresVideoEndScreenRepository(db),
  };
}

export type ContentLinkRepositories = ReturnType<typeof createContentLinkRepositories>;

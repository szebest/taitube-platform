import type { Repositories } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { assertNever } from '@vp/result';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { PostgresCategoryRepository } from './postgres-category-repository';
import { PostgresChannelRepository } from './postgres-channel-repository';
import { PostgresCommentRepository } from './postgres-comment-repository';
import { PostgresDlqRepository } from './postgres-dlq-repository';
import { PostgresEventRepository } from './postgres-event-repository';
import { PostgresOutboxRepository } from './postgres-outbox-repository';
import { PostgresRenditionRepository } from './postgres-rendition-repository';
import { PostgresStepRepository } from './postgres-step-repository';
import { PostgresSubscriptionRepository } from './postgres-subscription-repository';
import { PostgresUploadRepository } from './postgres-upload-repository';
import { PostgresUserRepository } from './postgres-user-repository';
import { PostgresVideoReactionRepository } from './postgres-video-reaction-repository';
import { PostgresVideoRepository } from './postgres-video-repository';
import { PostgresVideoStudioRepository } from './postgres-video-studio-repository';
import { PostgresVideoViewRepository } from './postgres-video-view-repository';
import type { PostgresDatabase } from './types';

/** A `drizzle` handle or a `sql` pool is borrowed; a `url` opens a pool the bundle ends. */
export type PostgresRepositoriesConfig =
  | { type: 'drizzle'; db: PostgresDatabase }
  | { type: 'sql'; sql: Sql }
  | { type: 'url'; url: string; max: number };

export class PostgresRepositories implements Repositories {
  readonly videos: PostgresVideoRepository;
  readonly videoStudio: PostgresVideoStudioRepository;
  readonly uploads: PostgresUploadRepository;
  readonly steps: PostgresStepRepository;
  readonly renditions: PostgresRenditionRepository;
  readonly events: PostgresEventRepository;
  readonly users: PostgresUserRepository;
  readonly dlq: PostgresDlqRepository;
  readonly outbox: PostgresOutboxRepository;
  readonly categories: PostgresCategoryRepository;
  readonly channels: PostgresChannelRepository;
  readonly videoReactions: PostgresVideoReactionRepository;
  readonly subscriptions: PostgresSubscriptionRepository;
  readonly videoViews: PostgresVideoViewRepository;
  readonly comments: PostgresCommentRepository;

  private readonly ownedPool: Sql | undefined;

  constructor(config: PostgresRepositoriesConfig) {
    const { db, ownedPool } = PostgresRepositories.connect(config);
    this.ownedPool = ownedPool;

    this.videos = new PostgresVideoRepository(db);
    this.videoStudio = new PostgresVideoStudioRepository(db);
    this.uploads = new PostgresUploadRepository(db);
    this.steps = new PostgresStepRepository(db);
    this.renditions = new PostgresRenditionRepository(db);
    this.events = new PostgresEventRepository(db);
    this.users = new PostgresUserRepository(db);
    this.dlq = new PostgresDlqRepository(db);
    this.outbox = new PostgresOutboxRepository(db);
    this.categories = new PostgresCategoryRepository(db);
    this.channels = new PostgresChannelRepository(db);
    this.videoReactions = new PostgresVideoReactionRepository(db);
    this.subscriptions = new PostgresSubscriptionRepository(db);
    this.videoViews = new PostgresVideoViewRepository(db);
    this.comments = new PostgresCommentRepository(db);
  }

  private static connect(config: PostgresRepositoriesConfig): {
    db: PostgresDatabase;
    ownedPool: Sql | undefined;
  } {
    switch (config.type) {
      case 'drizzle':
        return { db: config.db, ownedPool: undefined };
      case 'sql':
        return { db: drizzle(config.sql, { schema }), ownedPool: undefined };
      case 'url': {
        const sql = postgres(config.url, { max: config.max });
        return { db: drizzle(sql, { schema }), ownedPool: sql };
      }
      default:
        return assertNever(config, 'PostgresRepositoriesConfig');
    }
  }

  async close(): Promise<void> {
    await this.ownedPool?.end();
  }
}

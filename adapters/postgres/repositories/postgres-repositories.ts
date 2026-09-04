import type { Repositories } from '@vp/core/ports';
import * as schema from '@vp/db';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import type { PostgresDatabaseClient } from '../postgres-database-client.js';
import { PostgresDlqRepository } from './postgres-dlq-repository.js';
import { PostgresEventRepository } from './postgres-event-repository.js';
import { PostgresRenditionRepository } from './postgres-rendition-repository.js';
import { PostgresStepRepository } from './postgres-step-repository.js';
import { PostgresUploadRepository } from './postgres-upload-repository.js';
import { PostgresUserRepository } from './postgres-user-repository.js';
import { PostgresVideoRepository } from './postgres-video-repository.js';

export interface PostgresRepositoriesConfig {
  url?: string;
  max?: number;
  db?: PostgresJsDatabase<typeof schema>;
  sql?: Sql;
  client?: PostgresDatabaseClient;
}

export class PostgresRepositories implements Repositories {
  readonly videos: PostgresVideoRepository;
  readonly uploads: PostgresUploadRepository;
  readonly steps: PostgresStepRepository;
  readonly renditions: PostgresRenditionRepository;
  readonly events: PostgresEventRepository;
  readonly users: PostgresUserRepository;
  readonly dlq: PostgresDlqRepository;

  private readonly sql?: Sql;

  constructor(config: PostgresRepositoriesConfig = {}) {
    let db: PostgresJsDatabase<typeof schema>;

    if (config.db) {
      db = config.db;
      this.sql = config.sql;
    } else if (config.client) {
      this.sql = config.client.getRawSql();
      db = drizzle(this.sql, { schema });
    } else {
      const connectionString =
        config.url ||
        process.env['DATABASE_URL'] ||
        'postgres://vp:vppass@localhost:5432/videopipeline';
      const poolMax =
        config.max ??
        (process.env['DATABASE_POOL_MAX'] ? Number(process.env['DATABASE_POOL_MAX']) : 10);
      const client = postgres(connectionString, { max: poolMax });
      this.sql = client;
      db = drizzle(client, { schema });
    }

    this.videos = new PostgresVideoRepository(db);
    this.uploads = new PostgresUploadRepository(db);
    this.steps = new PostgresStepRepository(db);
    this.renditions = new PostgresRenditionRepository(db);
    this.events = new PostgresEventRepository(db);
    this.users = new PostgresUserRepository(db);
    this.dlq = new PostgresDlqRepository(db);
  }

  async close(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
    }
  }
}

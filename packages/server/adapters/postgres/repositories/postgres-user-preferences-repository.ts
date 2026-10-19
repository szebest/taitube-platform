import type { SavePreferencesOptions, UserPreferencesRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { UserPreferences } from '@vp/domain/settings';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { userPreferences: up } = schema;

export class PostgresUserPreferencesRepository implements UserPreferencesRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async find(userId: string): Promise<Result<UserPreferences | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(up).where(eq(up.userId, userId)).limit(1),
      databaseUnavailable.during('findPreferences')
    );
    return map(rows, ([row]) => row ?? null);
  }

  /**
   * The first save inserts and loses a race on the primary key; a later one updates only while the
   * version is the one it read. A transaction, so an event appended with the save commits with it.
   */
  async save(
    options: SavePreferencesOptions
  ): Promise<Result<UserPreferences | null, DatabaseUnavailable>> {
    const { userId, preferences, expectedVersion } = options;

    const rows = await fromPromise(
      () =>
        this.db.transaction((tx) =>
          expectedVersion === 0
            ? tx
                .insert(up)
                .values({ userId, ...preferences })
                .onConflictDoNothing({ target: up.userId })
                .returning()
            : tx
                .update(up)
                .set({ ...preferences, version: sql`${up.version} + 1`, updatedAt: new Date() })
                .where(and(eq(up.userId, userId), eq(up.version, expectedVersion)))
                .returning()
        ),
      databaseUnavailable.during('savePreferences')
    );
    return map(rows, ([row]) => row ?? null);
  }
}

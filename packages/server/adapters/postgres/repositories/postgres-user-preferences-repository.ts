import type { SavePreferencesOptions, UserPreferencesRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { preferencesUpdated } from '@vp/domain';
import type { UserPreferences } from '@vp/domain/settings';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, ok, type Result } from '@vp/result';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { appendUserEvent } from './postgres-user-event-repository';
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

  async findMany(
    userIds: readonly string[]
  ): Promise<Result<UserPreferences[], DatabaseUnavailable>> {
    if (userIds.length === 0) return ok([]);

    return fromPromise(
      () =>
        this.db
          .select()
          .from(up)
          .where(inArray(up.userId, [...userIds])),
      databaseUnavailable.during('findManyPreferences')
    );
  }

  /**
   * The first save inserts and loses a race on the primary key; a later one updates only while the
   * version is the one it read. The save and its `preferences.updated` commit together or not at all.
   */
  async save(
    options: SavePreferencesOptions
  ): Promise<Result<UserPreferences | null, DatabaseUnavailable>> {
    const { userId, preferences, expectedVersion, sections } = options;

    const rows = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const saved = await (expectedVersion === 0
            ? tx
                .insert(up)
                .values({ userId, ...preferences })
                .onConflictDoNothing({ target: up.userId })
                .returning()
            : tx
                .update(up)
                .set({ ...preferences, version: sql`${up.version} + 1`, updatedAt: new Date() })
                .where(and(eq(up.userId, userId), eq(up.version, expectedVersion)))
                .returning());
          const [row] = saved;
          if (row)
            await appendUserEvent(tx, { userId, ...preferencesUpdated(sections, row.version) });
          return saved;
        }),
      databaseUnavailable.during('savePreferences')
    );
    return map(rows, ([row]) => row ?? null);
  }
}

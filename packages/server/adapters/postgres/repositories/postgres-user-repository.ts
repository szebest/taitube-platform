import { type UpsertUserInput, type UserRecord, UserRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class PostgresUserRepository extends UserRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  private unavailable(operation: string) {
    return (cause: unknown): DatabaseUnavailable => databaseUnavailable(operation, cause);
  }

  async findById(id: string): Promise<Result<UserRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1),
      this.unavailable('findById')
    );

    return map(rows, ([row]) => row ?? null);
  }

  async upsert(user: UpsertUserInput): Promise<Result<UserRecord, DatabaseUnavailable>> {
    const rows = await fromPromise(
      this.db
        .insert(schema.users)
        .values({
          id: user.id,
          email: user.email,
          tier: user.tier ?? 'free',
          role: user.role ?? 'USER',
        })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            email: user.email,
            tier: user.tier ?? 'free',
            ...(user.role ? { role: user.role } : {}),
          },
        })
        .returning(),
      this.unavailable('upsert')
    );

    if (!rows.ok) return rows;
    const [row] = rows.value;
    return row ? ok(row) : err(databaseUnavailable('upsert', 'upsert returned no row'));
  }
}

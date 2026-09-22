import { DatabaseError } from '@vp/core/ports';
import { type UpsertUserInput, type UserRecord, UserRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class PostgresUserRepository extends UserRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async findById(id: string): Promise<UserRecord | null> {
    try {
      const rows = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1);
      return rows[0] ?? null;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to get user ${id}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async upsert(user: UpsertUserInput): Promise<UserRecord> {
    try {
      const [upserted] = await this.db
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
        .returning();

      if (!upserted) throw new DatabaseError('Failed to upsert user: empty return');
      return upserted;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to upsert user ${user.id}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}

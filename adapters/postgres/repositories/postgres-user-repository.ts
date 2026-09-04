import {
  DatabaseError,
  type UpsertUserInput,
  type UserRecord,
  UserRepository,
} from '@vp/core/ports';
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
      return (rows[0] as unknown as UserRecord) || null;
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
          tier: (user.tier || 'free') as any,
        })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            email: user.email,
            tier: (user.tier || 'free') as any,
          },
        })
        .returning();

      return upserted as unknown as UserRecord;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to upsert user ${user.id}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}

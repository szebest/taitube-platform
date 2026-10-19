import {
  type NewUserEventInput,
  type UserEventRecord,
  UserEventRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { MS_PER_DAY } from '@vp/domain/time';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { userChannel } from '@vp/events';
import { type Result, fromPromise, map } from '@vp/result';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { PostgresDatabase } from './types';

const { userEvents: ue } = schema;

/**
 * Writes the event and the outbox row that publishes it on `tx`, so a producer that appends inside
 * its own transaction announces nothing when that transaction rolls back.
 */
export async function appendUserEvent(
  tx: PostgresDatabase,
  event: NewUserEventInput
): Promise<UserEventRecord> {
  const [row] = await tx.insert(ue).values(event).returning();
  if (!row) throw new Error('user_events insert returned no row');

  await tx.insert(schema.outbox).values({
    id: uuidv7(),
    kind: 'user-event',
    payload: {
      type: 'pubsub',
      channel: userChannel(row.userId),
      message: JSON.stringify({ id: row.id, type: row.type, payload: row.payload }),
    },
  });
  return row;
}

export class PostgresUserEventRepository extends UserEventRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async append(event: NewUserEventInput): Promise<Result<UserEventRecord, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => appendUserEvent(tx, event)),
      databaseUnavailable.during('append')
    );
  }

  async listFrom(
    userId: string,
    fromId: number,
    limit: number
  ): Promise<Result<UserEventRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(ue)
          .where(and(eq(ue.userId, userId), gte(ue.id, fromId)))
          .orderBy(asc(ue.id))
          .limit(limit),
      databaseUnavailable.during('listFrom')
    );
  }

  async prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
    const rows = await fromPromise(
      () => this.db.delete(ue).where(lt(ue.createdAt, cutoff)).returning({ id: ue.id }),
      databaseUnavailable.during('prune')
    );

    return map(rows, (pruned) => pruned.length);
  }
}

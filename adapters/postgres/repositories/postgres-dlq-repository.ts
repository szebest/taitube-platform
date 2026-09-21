import {
  DatabaseError,
  type DlqEntryRecord,
  DlqRepository,
  type DlqStatus,
  type ListDlqEntriesOptions,
  type NewDlqEntryInput,
  type NewOutboxInput,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { desc, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzleWhere, keysetBefore } from '../scopes/index';
import { toDbError as dbErr } from './types';

const { dlqEntries: dlq } = schema;

export class PostgresDlqRepository extends DlqRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async create(entry: NewDlqEntryInput): Promise<DlqEntryRecord> {
    try {
      const rows = await this.db
        .insert(dlq)
        .values({
          id: entry.id,
          queue: entry.queue,
          jobId: entry.jobId,
          videoId: entry.videoId ?? null,
          payload: entry.payload,
          errorCode: entry.errorCode ?? null,
          errorMessage: entry.errorMessage ?? null,
          stack: entry.stack ?? null,
          attemptsMade: entry.attemptsMade,
          workerId: entry.workerId ?? null,
          status: entry.status ?? 'PARKED',
        })
        .onConflictDoUpdate({
          target: [dlq.queue, dlq.jobId, dlq.attemptsMade],
          set: {
            errorCode: entry.errorCode ?? null,
            errorMessage: entry.errorMessage ?? null,
            stack: entry.stack ?? null,
            workerId: entry.workerId ?? null,
          },
        })
        .returning();

      const created = rows[0];
      if (!created) throw new DatabaseError('Failed to create DLQ entry: empty return');
      return created;
    } catch (err: unknown) {
      throw dbErr(`Failed to create DLQ entry for job ${entry.jobId}`, err);
    }
  }

  async findById(id: string): Promise<DlqEntryRecord | null> {
    try {
      const rows = await this.db.select().from(dlq).where(eq(dlq.id, id)).limit(1);

      return rows[0] ?? null;
    } catch (err: unknown) {
      throw dbErr(`Failed to get DLQ entry ${id}`, err);
    }
  }

  async list(options: ListDlqEntriesOptions): Promise<DlqEntryRecord[]> {
    const { cursor, limit, status } = options;
    try {
      const rows = await this.db
        .select()
        .from(dlq)
        .where(
          drizzleWhere(
            status ? eq(dlq.status, status) : undefined,
            keysetBefore(
              dlq.createdAt,
              dlq.id,
              cursor && { sort: cursor.createdAt, tie: cursor.id }
            )
          )
        )
        .orderBy(desc(dlq.createdAt), desc(dlq.id))
        .limit(limit + 1);

      return rows as DlqEntryRecord[];
    } catch (err: unknown) {
      throw dbErr('Failed to list DLQ entries', err);
    }
  }

  async updateStatus(
    id: string,
    status: DlqStatus,
    patch?: { replayedAt?: Date },
    outbox?: NewOutboxInput
  ): Promise<DlqEntryRecord | null> {
    try {
      const updateData: { status: DlqStatus; replayedAt?: Date } = { status };
      if (patch?.replayedAt !== undefined) {
        updateData.replayedAt = patch.replayedAt;
      }

      if (outbox) {
        return await this.db.transaction(async (tx) => {
          const rows = await tx.update(dlq).set(updateData).where(eq(dlq.id, id)).returning();

          await tx.insert(schema.outbox).values({
            id: outbox.id || sql`gen_random_uuid()`,
            kind: outbox.kind,
            payload: outbox.payload,
            createdAt: new Date(),
            attempts: 0,
          });

          return rows[0] ?? null;
        });
      }

      const rows = await this.db.update(dlq).set(updateData).where(eq(dlq.id, id)).returning();

      return rows[0] ?? null;
    } catch (err: unknown) {
      throw dbErr(`Failed to update DLQ entry status ${id}`, err);
    }
  }
}

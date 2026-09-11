import {
  DatabaseError,
  type DlqEntryRecord,
  DlqRepository,
  type DlqStatus,
  type ListDlqEntriesOptions,
  type ListDlqEntriesResult,
  type NewDlqEntryInput,
  type NewOutboxInput,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), id })).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed.c && parsed.id) {
      return { createdAt: new Date(parsed.c), id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

export class PostgresDlqRepository extends DlqRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async create(entry: NewDlqEntryInput): Promise<DlqEntryRecord> {
    try {
      const rows = await this.db
        .insert(schema.dlqEntries)
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
          target: [
            schema.dlqEntries.queue,
            schema.dlqEntries.jobId,
            schema.dlqEntries.attemptsMade,
          ],
          set: {
            errorCode: entry.errorCode ?? null,
            errorMessage: entry.errorMessage ?? null,
            stack: entry.stack ?? null,
            workerId: entry.workerId ?? null,
          },
        })
        .returning();

      return rows[0] as unknown as DlqEntryRecord;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to create DLQ entry for job ${entry.jobId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async findById(id: string): Promise<DlqEntryRecord | null> {
    try {
      const rows = await this.db
        .select()
        .from(schema.dlqEntries)
        .where(eq(schema.dlqEntries.id, id))
        .limit(1);

      return (rows[0] as unknown as DlqEntryRecord) || null;
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to get DLQ entry ${id}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async list(options?: ListDlqEntriesOptions): Promise<ListDlqEntriesResult> {
    try {
      const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
      const conditions = [];

      if (options?.status) {
        conditions.push(eq(schema.dlqEntries.status, options.status));
      }

      if (options?.cursor) {
        const decoded = decodeCursor(options.cursor);
        if (decoded) {
          conditions.push(
            or(
              lt(schema.dlqEntries.createdAt, decoded.createdAt),
              and(
                eq(schema.dlqEntries.createdAt, decoded.createdAt),
                lt(schema.dlqEntries.id, decoded.id)
              )
            )
          );
        }
      }

      const query = this.db
        .select()
        .from(schema.dlqEntries)
        .orderBy(desc(schema.dlqEntries.createdAt), desc(schema.dlqEntries.id))
        .limit(limit + 1);

      const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows) as unknown as DlqEntryRecord[];
      const lastItem = hasMore && items.length > 0 ? items[items.length - 1] : undefined;
      const nextCursor = lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null;

      return { items, nextCursor };
    } catch (err: unknown) {
      throw new DatabaseError(`Failed to list DLQ entries: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async updateStatus(
    id: string,
    status: DlqStatus,
    patch?: { replayedAt?: Date },
    outbox?: NewOutboxInput
  ): Promise<DlqEntryRecord | null> {
    try {
      const updateData: { status: string; replayedAt?: Date } = { status };
      if (patch?.replayedAt !== undefined) {
        updateData.replayedAt = patch.replayedAt;
      }

      if (outbox) {
        return await this.db.transaction(async (tx) => {
          const rows = await tx
            .update(schema.dlqEntries)
            .set(updateData)
            .where(eq(schema.dlqEntries.id, id))
            .returning();

          await tx.insert(schema.outbox).values({
            id: outbox.id || sql`gen_random_uuid()`,
            kind: outbox.kind,
            payload: outbox.payload,
            createdAt: new Date(),
            attempts: 0,
          });

          return (rows[0] as unknown as DlqEntryRecord) || null;
        });
      }

      const rows = await this.db
        .update(schema.dlqEntries)
        .set(updateData)
        .where(eq(schema.dlqEntries.id, id))
        .returning();

      return (rows[0] as unknown as DlqEntryRecord) || null;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to update DLQ entry status ${id}: ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }
}

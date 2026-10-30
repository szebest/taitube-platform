import {
  type DlqEntryRecord,
  DlqRepository,
  type DlqStatus,
  type ListDlqEntriesOptions,
  type NewDlqEntryInput,
  type NewOutboxInput,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { desc, eq, sql } from 'drizzle-orm';
import { drizzleWhere, keysetBefore } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { dlqEntries: dlq } = schema;

export class PostgresDlqRepository extends DlqRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async create(entry: NewDlqEntryInput): Promise<Result<DlqEntryRecord, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
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
          .returning(),
      databaseUnavailable.during('create')
    );

    if (!rows.ok) return rows;
    const [created] = rows.value;
    return created ? ok(created) : err(databaseUnavailable('create', 'insert returned no row'));
  }

  async findById(id: string): Promise<Result<DlqEntryRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(dlq).where(eq(dlq.id, id)).limit(1),
      databaseUnavailable.during('findById')
    );

    return map(rows, ([row]) => row ?? null);
  }

  async list(
    options: ListDlqEntriesOptions
  ): Promise<Result<DlqEntryRecord[], DatabaseUnavailable>> {
    const { cursor, limit, status } = options;
    const rows = await fromPromise(
      () =>
        this.db
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
          .limit(limit + 1),
      databaseUnavailable.during('list')
    );

    return map(rows, (found) => found as DlqEntryRecord[]);
  }

  async updateStatus(
    id: string,
    status: DlqStatus,
    patch?: { replayedAt?: Date },
    outbox?: NewOutboxInput
  ): Promise<Result<DlqEntryRecord | null, DatabaseUnavailable>> {
    const updateData: { status: DlqStatus; replayedAt?: Date } = { status };
    if (patch?.replayedAt !== undefined) {
      updateData.replayedAt = patch.replayedAt;
    }

    if (!outbox) {
      const rows = await fromPromise(
        () => this.db.update(dlq).set(updateData).where(eq(dlq.id, id)).returning(),
        databaseUnavailable.during('updateStatus')
      );

      return map(rows, ([row]) => row ?? null);
    }

    const committed = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const rows = await tx.update(dlq).set(updateData).where(eq(dlq.id, id)).returning();

          await tx.insert(schema.outbox).values({
            id: outbox.id || sql`gen_random_uuid()`,
            kind: outbox.kind,
            payload: outbox.payload,
            createdAt: new Date(),
            attempts: 0,
          });

          return rows[0] ?? null;
        }),
      databaseUnavailable.during('updateStatus')
    );

    return committed;
  }
}

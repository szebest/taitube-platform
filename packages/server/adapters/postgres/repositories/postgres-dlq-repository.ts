import { type Result, err, fromPromise, map, ok } from '@kit/result';
import {
  type DlqEntryRecord,
  DlqRepository,
  type DlqTransition,
  type ListDlqEntriesOptions,
  type NewDlqEntryInput,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, msTimestamp } from '../scopes/index';
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
    const parkedAt = msTimestamp(dlq.createdAt);
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(dlq)
          .where(
            drizzleWhere(
              status ? eq(dlq.status, status) : undefined,
              keysetBefore(parkedAt, dlq.id, cursor && { sort: cursor.createdAt, tie: cursor.id })
            )
          )
          .orderBy(desc(parkedAt), desc(dlq.id))
          .limit(limit + 1),
      databaseUnavailable.during('list')
    );

    return map(rows, (found) => found as DlqEntryRecord[]);
  }

  async transition(
    options: DlqTransition
  ): Promise<Result<DlqEntryRecord | null, DatabaseUnavailable>> {
    const { id, from, to, replayedAt, outbox } = options;
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .update(dlq)
            .set({ status: to, ...(replayedAt ? { replayedAt } : {}) })
            .where(and(eq(dlq.id, id), inArray(dlq.status, [...from])))
            .returning();
          if (row && outbox) {
            await tx.insert(schema.outbox).values({
              id: outbox.id || sql`gen_random_uuid()`,
              kind: outbox.kind,
              payload: outbox.payload,
              createdAt: new Date(),
              attempts: 0,
            });
          }
          return row ?? null;
        }),
      databaseUnavailable.during('transition')
    );
  }
}

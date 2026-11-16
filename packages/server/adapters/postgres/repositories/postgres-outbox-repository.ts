import { type NewOutboxInput, type OutboxRecord, OutboxRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { OutboxStatus } from '@vp/domain';
import { OUTBOX_CLAIM_LEASE_MS, OUTBOX_ROW, decideOutboxAttempt } from '@vp/domain-rules';
import { MS_PER_DAY } from '@vp/domain/time';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { toOutboxRecord } from '../mappers/index';
import type { PostgresDatabase } from './types';

const { outbox: o } = schema;
const pending = [...OUTBOX_ROW.sources('publish')];

export class PostgresOutboxRepository extends OutboxRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async enqueue(item: NewOutboxInput): Promise<Result<OutboxRecord, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .insert(o)
          .values({
            id: item.id || uuidv7(),
            kind: item.kind,
            payload: item.payload,
            createdAt: new Date(),
            attempts: 0,
          })
          .returning(),
      databaseUnavailable.during('enqueue')
    );

    if (!rows.ok) return rows;
    const [row] = rows.value;
    return row
      ? ok(toOutboxRecord(row))
      : err(databaseUnavailable('enqueue', 'insert returned no row'));
  }

  async claimBatch(limit: number): Promise<Result<OutboxRecord[], DatabaseUnavailable>> {
    const now = new Date();
    const rows = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const free = await tx
            .select({ id: o.id })
            .from(o)
            .where(
              and(inArray(o.status, pending), or(isNull(o.claimableAt), lte(o.claimableAt, now)))
            )
            .orderBy(asc(o.createdAt))
            .for('update', { skipLocked: true })
            .limit(limit);
          if (free.length === 0) return [];

          return tx
            .update(o)
            .set({ claimableAt: new Date(now.getTime() + OUTBOX_CLAIM_LEASE_MS) })
            .where(
              inArray(
                o.id,
                free.map(({ id }) => id)
              )
            )
            .returning();
        }),
      databaseUnavailable.during('claimBatch')
    );

    return map(rows, (claimed) =>
      claimed.map(toOutboxRecord).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    );
  }

  async markPublished(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(o)
          .set({
            status: OUTBOX_ROW.target('publish'),
            publishedAt: new Date(),
            claimableAt: null,
          })
          .where(and(eq(o.id, id), inArray(o.status, pending)))
          .returning({ id: o.id }),
      databaseUnavailable.during('markPublished')
    );

    return map(rows, (updated) => updated.length > 0);
  }

  async recordAttempt(id: string): Promise<Result<OutboxStatus | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .select({ attempts: o.attempts })
            .from(o)
            .where(and(eq(o.id, id), inArray(o.status, pending)))
            .for('update');
          if (!row) return null;

          const attempts = row.attempts + 1;
          const { status, claimableAt } = decideOutboxAttempt(attempts, new Date());
          await tx.update(o).set({ attempts, status, claimableAt }).where(eq(o.id, id));
          return status;
        }),
      databaseUnavailable.during('recordAttempt')
    );
  }

  async prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
    const rows = await fromPromise(
      () =>
        this.db
          .delete(o)
          .where(and(sql`${o.publishedAt} IS NOT NULL`, lt(o.publishedAt, cutoff)))
          .returning({ id: o.id }),
      databaseUnavailable.during('prune')
    );

    return map(rows, (pruned) => pruned.length);
  }

  async findById(id: string): Promise<Result<OutboxRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(o).where(eq(o.id, id)).limit(1),
      databaseUnavailable.during('findById')
    );

    return map(rows, ([row]) => (row ? toOutboxRecord(row) : null));
  }
}

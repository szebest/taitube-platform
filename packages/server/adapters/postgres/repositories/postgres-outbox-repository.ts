import { type NewOutboxInput, type OutboxRecord, OutboxRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { MS_PER_DAY } from '@vp/domain/time';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { toOutboxRecord } from '../mappers/index';
import type { PostgresDatabase } from './types';

const { outbox: o } = schema;

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
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(o)
          .where(isNull(o.publishedAt))
          .orderBy(asc(o.createdAt))
          .for('update', { skipLocked: true })
          .limit(limit),
      databaseUnavailable.during('claimBatch')
    );

    return map(rows, (claimed) => claimed.map(toOutboxRecord));
  }

  async markPublished(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(o)
          .set({ publishedAt: new Date() })
          .where(eq(o.id, id))
          .returning({ id: o.id }),
      databaseUnavailable.during('markPublished')
    );

    return map(rows, (updated) => updated.length > 0);
  }

  async recordAttempt(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(o)
          .set({ attempts: sql`${o.attempts} + 1` })
          .where(eq(o.id, id))
          .returning({ id: o.id }),
      databaseUnavailable.during('recordAttempt')
    );

    return map(rows, (updated) => updated.length > 0);
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

    return map(rows, ([row]) => (row ? (row as OutboxRecord) : null));
  }
}

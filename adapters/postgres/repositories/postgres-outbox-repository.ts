import {
  DatabaseError,
  type NewOutboxInput,
  type OutboxRecord,
  OutboxRepository,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { toOutboxRecord } from '../mappers/index';
import { uuidv7 } from 'uuidv7';
import { toDbError as dbErr } from './types';

const { outbox: o } = schema;

export class PostgresOutboxRepository extends OutboxRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async enqueue(item: NewOutboxInput): Promise<OutboxRecord> {
    try {
      const id = item.id || uuidv7();
      const rows = await this.db
        .insert(o)
        .values({
          id,
          kind: item.kind,
          payload: item.payload,
          createdAt: new Date(),
          attempts: 0,
        })
        .returning();
      const row = rows[0];
      if (!row) throw new DatabaseError('Failed to insert outbox row');
      return toOutboxRecord(row);
    } catch (err) {
      throw dbErr('Failed to enqueue outbox item', err);
    }
  }

  async claimBatch(limit = 50): Promise<OutboxRecord[]> {
    try {
      const rows = await this.db
        .select()
        .from(o)
        .where(isNull(o.publishedAt))
        .orderBy(asc(o.createdAt))
        .for('update', { skipLocked: true })
        .limit(limit);
      return rows.map(toOutboxRecord);
    } catch (err) {
      throw dbErr('Failed to claim outbox batch', err);
    }
  }

  async markPublished(id: string): Promise<boolean> {
    try {
      const rows = await this.db
        .update(o)
        .set({ publishedAt: new Date() })
        .where(eq(o.id, id))
        .returning({ id: o.id });
      return rows.length > 0;
    } catch (err) {
      throw dbErr(`Failed to mark outbox item ${id} published`, err);
    }
  }

  async recordAttempt(id: string): Promise<boolean> {
    try {
      const rows = await this.db
        .update(o)
        .set({ attempts: sql`${o.attempts} + 1` })
        .where(eq(o.id, id))
        .returning({ id: o.id });
      return rows.length > 0;
    } catch (err) {
      throw dbErr(`Failed to record attempt for outbox item ${id}`, err);
    }
  }

  async prune(retentionDays = 7): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const rows = await this.db
        .delete(o)
        .where(and(sql`${o.publishedAt} IS NOT NULL`, lt(o.publishedAt, cutoff)))
        .returning({ id: o.id });
      return rows.length;
    } catch (err) {
      throw dbErr('Failed to prune published outbox items', err);
    }
  }

  async findById(id: string): Promise<OutboxRecord | null> {
    try {
      const rows = await this.db.select().from(o).where(eq(o.id, id)).limit(1);
      const row = rows[0];
      return row ? (row as OutboxRecord) : null;
    } catch (err) {
      throw dbErr(`Failed to find outbox item ${id}`, err);
    }
  }
}

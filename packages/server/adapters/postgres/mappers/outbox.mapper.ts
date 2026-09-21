import type { OutboxPayload, OutboxRecord } from '@vp/core/repositories';
import type { outbox } from '@vp/db';

type OutboxRow = typeof outbox.$inferSelect;

// jsonb is untyped on read; the writer side is what constrains the payload shape.
export function toOutboxRecord(row: OutboxRow): OutboxRecord {
  return { ...row, payload: row.payload as OutboxPayload };
}

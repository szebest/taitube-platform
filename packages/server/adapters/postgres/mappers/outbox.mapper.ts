import type { OutboxPayload, OutboxRecord } from '@vp/core/repositories';
import type { outbox } from '@vp/db';

type OutboxRow = typeof outbox.$inferSelect;

/** The claim lease is the relay's bookkeeping, not part of the record. jsonb is untyped on read. */
export function toOutboxRecord({ claimableAt: _lease, payload, ...row }: OutboxRow): OutboxRecord {
  return { ...row, payload: payload as OutboxPayload };
}

import * as schema from '@vp/db';
import type { ChannelAuditEntry, ModerationRecord, NewChannelAuditEntry } from '@vp/domain';
import { moderationOutbox } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';
import { enqueueNotificationJobs } from './notification-jobs';
import type { PostgresDatabase } from './types';

type AuditRow = typeof schema.channelAuditLog.$inferSelect;

/** The store holds only what `append` wrote from a typed entry, so the row reads back as one. */
export function toChannelAuditEntry(row: AuditRow): ChannelAuditEntry {
  return row as ChannelAuditEntry;
}

/** Written on the caller's transaction, so a change that rolls back leaves no audit row. */
export async function appendChannelAudit(
  tx: PostgresDatabase,
  entry: NewChannelAuditEntry
): Promise<ChannelAuditEntry> {
  const [row] = await tx
    .insert(schema.channelAuditLog)
    .values({ id: uuidv7(), createdAt: new Date(), ...entry })
    .returning();
  if (!row) throw new Error('channel audit insert returned no row');
  return toChannelAuditEntry(row);
}

/** The audit row of a moderation action and the notification job that tells the user, in one transaction. */
export async function appendModerationRecord(
  tx: PostgresDatabase,
  { audit, notice }: ModerationRecord
): Promise<void> {
  const entry = await appendChannelAudit(tx, audit);
  if (notice)
    await enqueueNotificationJobs(tx, [moderationOutbox({ eventId: entry.id, ...notice })]);
}

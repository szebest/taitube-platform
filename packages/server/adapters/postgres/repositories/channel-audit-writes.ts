import * as schema from '@vp/db';
import type { ChannelAuditEntry, NewChannelAuditEntry } from '@vp/domain';
import { uuidv7 } from 'uuidv7';
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

import type { PublishChannelLayout, PublishedChannelLayout } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import type { PostgresDatabase } from './types';
import { appendEntityRevision } from './video-revision-writes';

const { entityRevisions: er } = schema;

type RevisionRow = typeof er.$inferSelect;

export function toPublishedLayout(row: RevisionRow): PublishedChannelLayout {
  const snapshot = row.snapshot as Extract<typeof er.$inferSelect.snapshot, { document: unknown }>;
  return {
    version: row.version,
    document: snapshot.document,
    note: snapshot.note,
    authorUserId: row.authorUserId,
    restoredFromVersion: row.restoredFromVersion,
    createdAt: row.createdAt,
  };
}

export async function publishLayoutRevision(
  tx: PostgresDatabase,
  input: PublishChannelLayout
): Promise<PublishedChannelLayout> {
  const { channelId, document, authorUserId, note, restoredFromVersion } = input;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`channel_layout:${channelId}`}))`);
  const [newest] = await tx
    .select({ version: er.version })
    .from(er)
    .where(and(eq(er.entityType, 'channel_layout'), eq(er.entityId, channelId)))
    .orderBy(desc(er.version))
    .limit(1);
  const version = (newest?.version ?? 0) + 1;
  await appendEntityRevision(tx, {
    entityType: 'channel_layout',
    entityId: channelId,
    version,
    snapshot: { document, note },
    authorUserId,
    restoredFromVersion,
  });
  if (input.audit) await appendChannelAudit(tx, input.audit(version));
  return { version, document, note, authorUserId, restoredFromVersion, createdAt: new Date() };
}

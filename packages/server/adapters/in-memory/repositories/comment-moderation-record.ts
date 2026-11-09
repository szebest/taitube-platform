import type { CommentRemoval, NewChannelAuditEntry, NewCommentRemoval } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';

/** The audit row of a moderator's removal and, when the author is to be told, the removal the author lists. */
export async function recordModeration(
  audits: Pick<InMemoryChannelAuditRepository, 'append'>,
  removals: Map<string, CommentRemoval>,
  record: { audit: NewChannelAuditEntry; removal?: NewCommentRemoval } | undefined,
  now = new Date()
): Promise<Result<void, DatabaseUnavailable>> {
  if (!record) return ok();
  if (record.removal) removals.set(record.removal.id, { ...record.removal, createdAt: now });
  const audited = await audits.append(record.audit);
  return isErr(audited) ? audited : ok();
}

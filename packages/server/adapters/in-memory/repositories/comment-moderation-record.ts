import type { OutboxRepository } from '@vp/core/repositories';
import type { ModerationRecord } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { moderationOutbox } from '@vp/job-contracts';
import { isErr, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';

export interface ModerationSinks {
  auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;
  outboxRepo: Pick<OutboxRepository, 'enqueue'>;
}

/** The audit row of a moderator's action and, when the user is to be told, the notification job. */
export async function recordModeration(
  { auditRepo, outboxRepo }: ModerationSinks,
  record?: ModerationRecord
): Promise<Result<void, DatabaseUnavailable>> {
  if (!record) return ok();

  const entry = await auditRepo.append(record.audit);
  if (isErr(entry)) return entry;
  if (!record.notice) return ok();

  const queued = await outboxRepo.enqueue(
    moderationOutbox({ eventId: entry.value.id, ...record.notice })
  );
  return isErr(queued) ? queued : ok();
}

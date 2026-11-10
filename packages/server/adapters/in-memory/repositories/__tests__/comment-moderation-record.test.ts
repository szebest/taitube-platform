import type { ModerationNotice, NewChannelAuditEntry } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { recordModeration } from '../comment-moderation-record';
import { InMemoryChannelAuditRepository } from '../in-memory-channel-audit-repository';
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository';

const audit: NewChannelAuditEntry = {
  channelId: 'channel',
  actorUserId: 'actor',
  action: 'comment.removed',
  targetType: 'comment',
  targetId: 'comment',
  meta: { videoId: 'video', disclosure: 'visible' },
};
const notice: ModerationNotice = {
  userId: '00000000-0000-7000-8000-000000000001',
  action: 'remove',
  channelId: '00000000-0000-7000-8000-000000000002',
  videoId: null,
  commentId: null,
  reason: 'spam',
  expiresAt: null,
  excerpt: 'hello',
};

describe('adapters/in-memory: recordModeration', () => {
  it.each([
    { scenario: 'a record with a notice', record: { audit, notice }, audited: 1, queued: 1 },
    { scenario: 'a record without a notice', record: { audit }, audited: 1, queued: 0 },
    { scenario: 'no record', record: undefined, audited: 0, queued: 0 },
  ])('writes $audited audit rows and $queued jobs for $scenario', async (given) => {
    const sinks = {
      auditRepo: new InMemoryChannelAuditRepository(),
      outboxRepo: new InMemoryOutboxRepository(),
    };

    await recordModeration(sinks, given.record);

    const logged = await sinks.auditRepo.list('channel', { cursor: null, limit: 10 });
    expect(logged.ok && logged.value).toHaveLength(given.audited);
    expect(sinks.outboxRepo.getAll()).toHaveLength(given.queued);
  });

  it('names the job after the audit row, so one action is one job', async () => {
    const sinks = {
      auditRepo: new InMemoryChannelAuditRepository(),
      outboxRepo: new InMemoryOutboxRepository(),
    };

    await recordModeration(sinks, { audit, notice });

    const [entry] = expectOk(await sinks.auditRepo.list('channel', { cursor: null, limit: 1 }));
    expect(JSON.stringify(sinks.outboxRepo.getAll())).toContain(`${entry?.id}--notify-moderation`);
  });
});

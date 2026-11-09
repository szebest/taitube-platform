import type { CommentRemoval, NewChannelAuditEntry } from '@vp/domain';
import { recordModeration } from '../comment-moderation-record';
import { InMemoryChannelAuditRepository } from '../in-memory-channel-audit-repository';

const audit: NewChannelAuditEntry = {
  channelId: 'channel',
  actorUserId: 'actor',
  action: 'comment.removed',
  targetType: 'comment',
  targetId: 'comment',
  meta: { videoId: 'video', disclosure: 'visible' },
};
const removal = {
  id: 'comment',
  channelId: 'channel',
  videoId: 'video',
  authorId: 'author',
  excerpt: 'hello',
  reason: 'spam',
  note: null,
  disclosure: 'visible',
  removedBy: 'actor',
} as const;

describe('adapters/in-memory: recordModeration', () => {
  it.each([
    { scenario: 'a record with a removal', record: { audit, removal }, removals: 1, audited: 1 },
    { scenario: 'a record without a removal', record: { audit }, removals: 0, audited: 1 },
    { scenario: 'no record', record: undefined, removals: 0, audited: 0 },
  ])('writes $removals removals and $audited audit rows for $scenario', async (given) => {
    const audits = new InMemoryChannelAuditRepository();
    const removals = new Map<string, CommentRemoval>();
    const now = new Date('2026-01-01T00:00:00.000Z');

    await recordModeration(audits, removals, given.record, now);

    expect(removals.size).toBe(given.removals);
    expect(removals.get('comment')?.createdAt).toEqual(given.removals ? now : undefined);
    const logged = await audits.list('channel', { cursor: null, limit: 10 });
    expect(logged.ok && logged.value).toHaveLength(given.audited);
  });
});

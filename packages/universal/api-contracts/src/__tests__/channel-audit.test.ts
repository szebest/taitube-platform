import { CHANNEL_AUDIT_ACTIONS } from '@vp/domain';
import { AuditPageSchema } from '../channel-audit';

const ID = '00000000-0000-7000-8000-0000000000a1';

const entry = (action: string, targetType: string, meta: object) => ({
  id: ID,
  action,
  targetType,
  targetId: ID,
  meta,
  actorUserId: ID,
  actor: null,
  createdAt: '2026-03-01T12:00:00.000Z',
});

describe('packages/api-contracts: the channel audit entry', () => {
  it.each([
    entry('invite.created', 'invite', { inviteeUserId: ID, role: 'editor' }),
    entry('video.updated', 'video', { fields: ['title'] }),
    entry('video.comments.toggled', 'video', { enabled: false }),
    entry('comment.hidden', 'comment', { videoId: ID, disclosure: 'silent' }),
    entry('comment.pinned', 'comment', { videoId: ID, pinned: true }),
    entry('user.shadow_banned', 'user', {}),
    entry('user.banned', 'user', { expiresAt: null }),
    entry('user.restriction_lifted', 'user', { kind: 'ban' }),
    entry('settings.comments.updated', 'settings', { fields: ['blockedWords'] }),
  ])('reads a $action row with its own meta', (row) => {
    expect(AuditPageSchema.safeParse({ items: [row], nextCursor: null }).success).toBe(true);
  });

  it.each([
    {
      scenario: 'a disclosure that is no disclosure',
      row: entry('comment.held', 'comment', { videoId: ID, disclosure: 'loud' }),
    },
    {
      scenario: 'a settings field that does not exist',
      row: entry('settings.comments.updated', 'settings', { fields: ['mood'] }),
    },
    { scenario: 'an action nobody audits', row: entry('comment.liked', 'comment', {}) },
  ])('refuses $scenario', ({ row }) => {
    expect(AuditPageSchema.safeParse({ items: [row], nextCursor: null }).success).toBe(false);
  });

  it('describes every action the log can hold', () => {
    const described = CHANNEL_AUDIT_ACTIONS.filter((action) => {
      const probe = AuditPageSchema.safeParse({
        items: [entry(action, 'x', {})],
        nextCursor: null,
      });
      return !probe.success && probe.error.issues.every((issue) => issue.code !== 'invalid_union');
    });

    expect(described).toEqual(CHANNEL_AUDIT_ACTIONS);
  });
});

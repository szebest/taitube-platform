import {
  COMMENT_MODERATION_REASONS,
  commentModerationAudit,
  liftAudit,
  restrictionAudit,
} from '../comment-moderation';
import { COMMENT_REPORT_REASONS } from '../comment-report';

describe('@vp/domain: comment moderation reasons', () => {
  it('is the report reasons plus off_topic', () => {
    expect(COMMENT_MODERATION_REASONS).toEqual([...COMMENT_REPORT_REASONS, 'off_topic']);
  });
});

describe('@vp/domain: commentModerationAudit', () => {
  it.each([
    ['hold', 'comment.held'],
    ['approve', 'comment.approved'],
    ['hide', 'comment.hidden'],
    ['unhide', 'comment.unhidden'],
    ['remove', 'comment.removed'],
  ] as const)('writes %s as %s with the disclosure and the video', (action, audited) => {
    expect(
      commentModerationAudit({
        channelId: 'channel',
        actorUserId: 'moderator',
        action,
        commentId: 'comment',
        videoId: 'video',
        disclosure: 'visible',
      })
    ).toEqual({
      channelId: 'channel',
      actorUserId: 'moderator',
      action: audited,
      targetType: 'comment',
      targetId: 'comment',
      meta: { videoId: 'video', disclosure: 'visible' },
    });
  });
});

describe('@vp/domain: restriction audit', () => {
  const ids = { channelId: 'channel', actorUserId: 'moderator', userId: 'user' };

  it.each([
    {
      scenario: 'a shadow ban',
      restriction: { kind: 'shadow', expiresAt: null },
      expected: { action: 'user.shadow_banned', meta: {} },
    },
    {
      scenario: 'a permanent ban',
      restriction: { kind: 'ban', expiresAt: null },
      expected: { action: 'user.banned', meta: { expiresAt: null } },
    },
    {
      scenario: 'a timeout',
      restriction: { kind: 'ban', expiresAt: new Date('2026-03-02T12:00:00.000Z') },
      expected: { action: 'user.banned', meta: { expiresAt: '2026-03-02T12:00:00.000Z' } },
    },
  ] as const)('writes $scenario', ({ restriction, expected }) => {
    expect(restrictionAudit({ ...ids, restriction })).toEqual({
      channelId: 'channel',
      actorUserId: 'moderator',
      targetType: 'user',
      targetId: 'user',
      ...expected,
    });
  });

  it('writes a lift with the kind that was lifted', () => {
    expect(liftAudit({ ...ids, kind: 'ban' })).toMatchObject({
      action: 'user.restriction_lifted',
      targetId: 'user',
      meta: { kind: 'ban' },
    });
  });
});

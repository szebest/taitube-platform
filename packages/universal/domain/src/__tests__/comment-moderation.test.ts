import { COMMENT_MODERATION_REASONS, commentModerationAudit } from '../comment-moderation';
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

import type { Comment } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { deletionAudit, pinAudit } from '../comment-audit';

const ACTOR: UserContext = { id: 'moderator-1', role: 'USER' };

const onVideo = {
  id: 'comment-1',
  target: { type: 'video', id: 'video-1' },
  channelId: 'channel-1',
  authorId: 'author-1',
} as Comment;

const onPost = { ...onVideo, target: { type: 'post', id: 'post-1' } } as Comment;

describe('apps/server/api/services: comment audit', () => {
  it.each([
    { scenario: 'a moderator deleting', comment: onVideo, videoId: 'video-1' },
    { scenario: 'a moderator deleting on a post', comment: onPost, videoId: null },
  ])('logs $scenario silently', ({ comment, videoId }) => {
    expect(deletionAudit(ACTOR, comment)).toEqual({
      audit: {
        channelId: 'channel-1',
        actorUserId: 'moderator-1',
        action: 'comment.removed',
        targetType: 'comment',
        targetId: 'comment-1',
        meta: { videoId, disclosure: 'silent' },
      },
    });
  });

  it('logs nothing when the author deletes their own comment', () => {
    expect(deletionAudit({ ...ACTOR, id: 'author-1' }, onVideo)).toBeUndefined();
  });

  it.each([
    { pinned: true, comment: onVideo, videoId: 'video-1' },
    { pinned: false, comment: onPost, videoId: null },
  ])('logs a pin of $pinned with the video $videoId', ({ pinned, comment, videoId }) => {
    expect(pinAudit(ACTOR, comment, pinned)).toEqual({
      channelId: 'channel-1',
      actorUserId: 'moderator-1',
      action: 'comment.pinned',
      targetType: 'comment',
      targetId: 'comment-1',
      meta: { videoId, pinned },
    });
  });
});

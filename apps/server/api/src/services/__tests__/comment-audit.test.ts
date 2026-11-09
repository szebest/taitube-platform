import type { Comment } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { deletionAudit, pinAudit } from '../comment-audit';

const ACTOR: UserContext = { id: 'moderator-1', role: 'USER' };
const comment = { id: 'comment-1', videoId: 'video-1', authorId: 'author-1' } as Comment;

describe('apps/server/api/services: comment audit', () => {
  it.each([
    { scenario: 'a moderator deleting', actor: ACTOR, channelId: 'channel-1', logged: true },
    {
      scenario: 'the author deleting',
      actor: { ...ACTOR, id: 'author-1' },
      channelId: 'channel-1',
      logged: false,
    },
    { scenario: 'a video without a channel', actor: ACTOR, channelId: undefined, logged: false },
  ])('logs $scenario silently: $logged', ({ actor, channelId, logged }) => {
    expect(deletionAudit(channelId, actor, comment)).toEqual(
      logged
        ? {
            audit: {
              channelId: 'channel-1',
              actorUserId: 'moderator-1',
              action: 'comment.removed',
              targetType: 'comment',
              targetId: 'comment-1',
              meta: { videoId: 'video-1', disclosure: 'silent' },
            },
          }
        : undefined
    );
  });

  it.each([true, false])('logs a pin of %s with the video', (pinned) => {
    expect(pinAudit('channel-1', ACTOR, comment, pinned)).toEqual({
      channelId: 'channel-1',
      actorUserId: 'moderator-1',
      action: 'comment.pinned',
      targetType: 'comment',
      targetId: 'comment-1',
      meta: { videoId: 'video-1', pinned },
    });
  });

  it('logs nothing for a video without a channel', () => {
    expect(pinAudit(undefined, ACTOR, comment, true)).toBeUndefined();
  });
});

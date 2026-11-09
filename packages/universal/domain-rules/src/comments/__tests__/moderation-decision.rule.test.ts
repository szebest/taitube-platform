import type { CommentModerationAction } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { isErr, isOk } from '@vp/result';
import { AUTHOR, OWNER, STRANGER, aComment, aVideo } from '../../__tests__/entities';
import { decideCommentModeration } from '../moderation-decision.rule';

const video = aVideo();
const MODERATOR_ON_CHANNEL: UserContext = {
  id: 'member-1',
  role: 'USER',
  memberships: { 'channel-1': { ownerId: OWNER.id, role: 'moderator' } },
};
const EDITOR_ON_CHANNEL: UserContext = {
  id: 'member-2',
  role: 'USER',
  memberships: { 'channel-1': { ownerId: OWNER.id, role: 'editor' } },
};

const HIDE: CommentModerationAction = { action: 'hide', disclosure: 'silent' };

describe('@vp/domain-rules: decideCommentModeration', () => {
  it.each([
    { scenario: 'the video owner', actor: OWNER },
    { scenario: 'a moderator of the channel', actor: MODERATOR_ON_CHANNEL },
  ])('lets $scenario hide a published comment', ({ actor }) => {
    const comment = aComment();

    const result = decideCommentModeration({
      actor,
      comment,
      commentId: comment.id,
      video,
      action: HIDE,
    });

    expect(isOk(result) && result.value.outcome.state).toBe('hidden');
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'the comment author', actor: AUTHOR, code: ErrorCodes.FORBIDDEN },
    { scenario: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { scenario: 'an editor of the channel', actor: EDITOR_ON_CHANNEL, code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code before looking at the state', ({ actor, code }) => {
    const comment = aComment({ moderationState: 'held' });

    const result = decideCommentModeration({
      actor,
      comment,
      commentId: comment.id,
      video,
      action: HIDE,
    });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('refuses an action the state does not allow', () => {
    const comment = aComment({ moderationState: 'held' });

    const result = decideCommentModeration({
      actor: OWNER,
      comment,
      commentId: comment.id,
      video,
      action: HIDE,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.MODERATION_NOT_APPLICABLE);
  });

  it.each([
    { scenario: 'an absent comment', comment: null, under: video },
    { scenario: 'a comment whose video is gone', comment: aComment(), under: null },
  ])('reports $scenario as COMMENT_NOT_FOUND', ({ comment, under }) => {
    const result = decideCommentModeration({
      actor: OWNER,
      comment,
      commentId: 'gone',
      video: under,
      action: HIDE,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });
});

import { isErr, isOk } from '@kit/result';
import type { CommentHost } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import {
  ADMIN,
  AUTHOR,
  MODERATOR,
  OWNER,
  STRANGER,
  aComment,
  aVideo,
} from '../../__tests__/entities';
import { decideCommentHeart } from '../heart-comment.rule';

const video = aVideo();
const host: CommentHost = { type: 'video', video };
const comment = aComment();

describe('@vp/domain-rules: decideCommentHeart', () => {
  it.each<{ scenario: string; actor: UserContext }>([
    { scenario: 'the video owner', actor: OWNER },
    { scenario: 'an admin who owns the video', actor: ADMIN },
  ])('lets $scenario heart the comment', ({ actor }) => {
    const owned: CommentHost = { type: 'video', video: { ...video, ownerId: actor.id } };
    const result = decideCommentHeart({ actor, comment, commentId: comment.id, host: owned });

    expect(isOk(result) && result.value).toBe(comment);
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'the comment author', actor: AUTHOR, code: ErrorCodes.FORBIDDEN },
    { scenario: 'a moderator', actor: MODERATOR, code: ErrorCodes.FORBIDDEN },
    { scenario: 'an admin', actor: ADMIN, code: ErrorCodes.FORBIDDEN },
    { scenario: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code', ({ actor, code }) => {
    const result = decideCommentHeart({ actor, comment, commentId: comment.id, host });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('reports an absent comment as COMMENT_NOT_FOUND', () => {
    const result = decideCommentHeart({ actor: OWNER, comment: null, commentId: 'x', host });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });
});

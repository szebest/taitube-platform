import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { isErr, isOk } from '@vp/result';
import {
  ADMIN,
  AUTHOR,
  MODERATOR,
  OWNER,
  STRANGER,
  aComment,
  aVideo,
} from '../../__tests__/entities';
import { decideCommentDelete, decideCommentPin } from '../moderate-comment.rule';

const video = aVideo();
const comment = aComment();

describe('@vp/domain-rules: decideCommentDelete', () => {
  it.each<{ scenario: string; actor: UserContext }>([
    { scenario: 'the author', actor: AUTHOR },
    { scenario: 'the video owner', actor: OWNER },
    { scenario: 'a moderator', actor: MODERATOR },
    { scenario: 'an admin', actor: ADMIN },
  ])('lets $scenario delete the comment', ({ actor }) => {
    const result = decideCommentDelete({ actor, comment, commentId: comment.id, video });

    expect(isOk(result) && result.value).toBe(comment);
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code', ({ actor, code }) => {
    const result = decideCommentDelete({ actor, comment, commentId: comment.id, video });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each([
    { scenario: 'an absent comment', target: null, under: video },
    { scenario: 'a comment whose video is gone', target: comment, under: null },
  ])('reports $scenario as COMMENT_NOT_FOUND', ({ target, under }) => {
    const result = decideCommentDelete({
      actor: AUTHOR,
      comment: target,
      commentId: 'comment-1',
      video: under,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });
});

describe('@vp/domain-rules: decideCommentPin', () => {
  it.each<{ scenario: string; actor: UserContext }>([
    { scenario: 'the video owner', actor: OWNER },
    { scenario: 'an admin', actor: ADMIN },
  ])('lets $scenario pin a top-level comment', ({ actor }) => {
    const result = decideCommentPin({ actor, comment, commentId: comment.id, video });

    expect(isOk(result) && result.value).toBe(comment);
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'the author', actor: AUTHOR, code: ErrorCodes.FORBIDDEN },
    { scenario: 'a moderator', actor: MODERATOR, code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code', ({ actor, code }) => {
    const result = decideCommentPin({ actor, comment, commentId: comment.id, video });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('refuses to pin a reply', () => {
    const reply = aComment({ parentId: 'root-1' });

    const result = decideCommentPin({ actor: OWNER, comment: reply, commentId: reply.id, video });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_PINNABLE);
  });

  it('reports an absent comment as COMMENT_NOT_FOUND', () => {
    const result = decideCommentPin({ actor: OWNER, comment: null, commentId: 'gone', video });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });
});

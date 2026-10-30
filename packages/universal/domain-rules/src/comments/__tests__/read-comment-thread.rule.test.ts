import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { STRANGER, aComment, aVideo } from '../../__tests__/entities';
import { decideCommentThreadRead } from '../read-comment-thread.rule';

const video = aVideo();
const comment = aComment();

describe('@vp/domain-rules: decideCommentThreadRead', () => {
  it('opens the thread of a comment under a readable video', () => {
    const result = decideCommentThreadRead({
      viewer: null,
      comment,
      commentId: comment.id,
      video,
    });

    expect(isOk(result) && result.value).toEqual({ comment, video });
  });

  it.each([
    {
      scenario: 'an absent comment',
      target: null,
      under: video,
      code: ErrorCodes.COMMENT_NOT_FOUND,
    },
    {
      scenario: 'a comment whose video is gone',
      target: comment,
      under: null,
      code: ErrorCodes.COMMENT_NOT_FOUND,
    },
    {
      scenario: 'a comment under a video the viewer may not read',
      target: comment,
      under: aVideo({ visibility: 'private' }),
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario with $code', ({ target, under, code }) => {
    const result = decideCommentThreadRead({
      viewer: STRANGER,
      comment: target,
      commentId: 'comment-1',
      video: under,
    });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});

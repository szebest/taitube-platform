import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { STRANGER, aComment, aVideo, videoHost } from '../../__tests__/entities';
import { decideCommentThreadRead } from '../read-comment-thread.rule';

const video = aVideo();
const host = videoHost(video);
const comment = aComment();

describe('@vp/domain-rules: decideCommentThreadRead', () => {
  it('opens the thread of a comment under a readable video', () => {
    const result = decideCommentThreadRead({
      viewer: null,
      comment,
      commentId: comment.id,
      host,
    });

    expect(isOk(result) && result.value).toEqual({ comment, host });
  });

  it.each([
    {
      scenario: 'an absent comment',
      target: null,
      under: host,
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
      under: videoHost(aVideo({ visibility: 'private' })),
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario with $code', ({ target, under, code }) => {
    const result = decideCommentThreadRead({
      viewer: STRANGER,
      comment: target,
      commentId: 'comment-1',
      host: under,
    });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});

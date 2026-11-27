import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { aComment, aVideo, videoHost } from '../../__tests__/entities';
import { locateComment } from '../located-comment';

describe('@vp/domain-rules: locateComment', () => {
  it('hands back the comment with its video', () => {
    const comment = aComment();
    const host = videoHost(aVideo());

    const result = locateComment({ comment, commentId: comment.id, host });

    expect(isOk(result) && result.value).toEqual({ comment, host });
  });

  it.each([
    { scenario: 'an absent comment', comment: null, host: videoHost(aVideo()) },
    { scenario: 'a comment whose video is gone', comment: aComment(), host: null },
  ])('reports $scenario as COMMENT_NOT_FOUND', ({ comment, host }) => {
    const result = locateComment({ comment, commentId: 'comment-1', host });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });
});

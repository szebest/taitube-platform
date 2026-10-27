import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { aComment, aVideo } from '../../__tests__/entities';
import { locateComment } from '../located-comment';

describe('@vp/domain-rules: locateComment', () => {
  it('hands back the comment with its video', () => {
    const comment = aComment();
    const video = aVideo();

    const result = locateComment({ comment, commentId: comment.id, video });

    expect(isOk(result) && result.value).toEqual({ comment, video });
  });

  it.each([
    { scenario: 'an absent comment', comment: null, video: aVideo() },
    { scenario: 'a comment whose video is gone', comment: aComment(), video: null },
  ])('reports $scenario as COMMENT_NOT_FOUND', ({ comment, video }) => {
    const result = locateComment({ comment, commentId: 'comment-1', video });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });
});

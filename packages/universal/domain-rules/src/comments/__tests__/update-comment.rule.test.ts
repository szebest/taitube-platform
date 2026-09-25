import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { AUTHOR, MODERATOR, OWNER, aComment } from '../../__tests__/entities';
import { decideCommentUpdate } from '../update-comment.rule';

const comment = aComment();

describe('@vp/domain-rules: decideCommentUpdate', () => {
  it('lets the author edit, normalising the new content', () => {
    const result = decideCommentUpdate({
      actor: AUTHOR,
      comment,
      commentId: comment.id,
      content: ' edited ',
    });

    expect(isOk(result) && result.value).toEqual({ comment, content: 'edited' });
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'the video owner', actor: OWNER, code: ErrorCodes.FORBIDDEN },
    { scenario: 'a moderator', actor: MODERATOR, code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code', ({ actor, code }) => {
    const result = decideCommentUpdate({ actor, comment, commentId: comment.id, content: 'x' });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('reports an absent comment as COMMENT_NOT_FOUND', () => {
    const result = decideCommentUpdate({
      actor: AUTHOR,
      comment: null,
      commentId: 'gone',
      content: 'x',
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
  });

  it('refuses blank content from the author', () => {
    const result = decideCommentUpdate({
      actor: AUTHOR,
      comment,
      commentId: comment.id,
      content: '',
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});

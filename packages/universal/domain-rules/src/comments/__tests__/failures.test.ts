import { ErrorCodes, isInputFailure } from '@vp/errors';
import { commentNotFound, commentNotPinnable } from '../failures';

describe('@vp/domain-rules: comment failures', () => {
  it.each([
    { name: 'commentNotFound', failure: commentNotFound('c1'), code: ErrorCodes.COMMENT_NOT_FOUND },
    {
      name: 'commentNotPinnable',
      failure: commentNotPinnable('c1'),
      code: ErrorCodes.COMMENT_NOT_PINNABLE,
    },
  ])('$name carries $code and the comment id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, commentId: 'c1' });
    expect(isInputFailure(failure)).toBe(false);
  });
});

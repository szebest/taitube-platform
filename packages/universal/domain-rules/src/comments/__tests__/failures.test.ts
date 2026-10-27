import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  commentAlreadyReported,
  commentNotFound,
  commentNotPinnable,
  reportAlreadyResolved,
  reportNotFound,
} from '../failures';

describe('@vp/domain-rules: comment failures', () => {
  it.each([
    { name: 'commentNotFound', failure: commentNotFound('c1'), code: ErrorCodes.COMMENT_NOT_FOUND },
    {
      name: 'commentNotPinnable',
      failure: commentNotPinnable('c1'),
      code: ErrorCodes.COMMENT_NOT_PINNABLE,
    },
    {
      name: 'commentAlreadyReported',
      failure: commentAlreadyReported('c1'),
      code: ErrorCodes.COMMENT_ALREADY_REPORTED,
    },
  ])('$name carries $code and the comment id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, commentId: 'c1' });
    expect(isInputFailure(failure)).toBe(false);
  });

  it.each([
    { name: 'reportNotFound', failure: reportNotFound('r1'), code: ErrorCodes.REPORT_NOT_FOUND },
    {
      name: 'reportAlreadyResolved',
      failure: reportAlreadyResolved('r1'),
      code: ErrorCodes.REPORT_ALREADY_RESOLVED,
    },
  ])('$name carries $code and the report id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, reportId: 'r1' });
    expect(isInputFailure(failure)).toBe(false);
  });
});

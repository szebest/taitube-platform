import { ErrorCodes } from '@vp/errors';
import { threadAnchorInvalid, threadLimit, threadNotFound, threadPinLimit } from '../failures';

describe('@vp/domain-rules: thread failures', () => {
  it.each([
    { failure: threadNotFound('t'), code: ErrorCodes.THREAD_NOT_FOUND },
    { failure: threadLimit(5), code: ErrorCodes.THREAD_LIMIT },
    { failure: threadPinLimit(3), code: ErrorCodes.THREAD_PIN_LIMIT },
    { failure: threadAnchorInvalid(9, 5), code: ErrorCodes.THREAD_ANCHOR_INVALID },
  ])('names $code', ({ failure, code }) => {
    expect(failure.code).toBe(code);
  });
});

import { ErrorCodes, isInputFailure } from '@vp/errors';
import { sseStreamLimitReached, sseUnavailable } from '../sse-failures';

describe('apps/api/services: SSE register failures', () => {
  it.each([
    {
      name: 'sseUnavailable',
      failure: sseUnavailable('SSE hub is shutting down'),
      code: ErrorCodes.STORAGE_UNAVAILABLE,
    },
    {
      name: 'sseStreamLimitReached',
      failure: sseStreamLimitReached('user-1', 20),
      code: ErrorCodes.RATE_LIMITED,
    },
  ])('$name carries $code and stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });

  it('repeats the capacity reason back to the operator', () => {
    expect(sseUnavailable('Maximum pod SSE connection limit reached')).toMatchObject({
      message: 'Maximum pod SSE connection limit reached',
      reason: 'Maximum pod SSE connection limit reached',
    });
  });

  it('names the user and the budget they ran out of', () => {
    expect(sseStreamLimitReached('user-1', 20)).toMatchObject({
      userId: 'user-1',
      limit: 20,
      message: 'Maximum active SSE streams (20) exceeded for user',
    });
  });
});

import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import { sseStreamLimitReached, sseUnavailable } from '../sse-failures';

describe('apps/server/api/services: SSE register failures', () => {
  it.each([
    {
      name: 'sseUnavailable',
      failure: sseUnavailable('SSE hub is shutting down'),
      code: ErrorCodes.STORAGE_UNAVAILABLE,
    },
    {
      name: 'sseStreamLimitReached',
      failure: sseStreamLimitReached('user', 'user-1', 20),
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

  it.each([
    {
      subject: 'user',
      key: 'user-1',
      message: 'Maximum active SSE streams (20) exceeded for user',
    },
    {
      subject: 'ip',
      key: '203.0.113.9',
      message: 'Maximum active SSE streams (20) exceeded for ip',
    },
  ] as const)('names the $subject and the budget they ran out of', ({ subject, key, message }) => {
    expect(sseStreamLimitReached(subject, key, 20)).toMatchObject({
      subject,
      key,
      limit: 20,
      message,
    });
  });
});

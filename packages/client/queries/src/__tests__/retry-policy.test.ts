import { ApiContractError, ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { retryDelay, shouldRetry } from '../retry-policy';

describe('@vp/queries: retry policy', () => {
  it.each([
    {
      failure: 'a permanent code',
      error: new ApiError(404, ErrorCodes.VIDEO_NOT_FOUND, ''),
      expected: false,
    },
    {
      failure: 'a transient code',
      error: new ApiError(503, ErrorCodes.DATABASE_UNAVAILABLE, ''),
      expected: true,
    },
    {
      failure: 'a rate limit',
      error: new ApiError(429, ErrorCodes.RATE_LIMITED, ''),
      expected: true,
    },
    {
      failure: 'an unclassified 502',
      error: new ApiError(502, 'HTTP_ERROR', ''),
      expected: true,
    },
    {
      failure: 'an unclassified 400',
      error: new ApiError(400, 'HTTP_ERROR', ''),
      expected: false,
    },
    {
      failure: 'a broken contract',
      error: new ApiContractError('GET /v1/x', []),
      expected: false,
    },
    {
      failure: 'a dropped connection',
      error: new TypeError('fetch failed'),
      expected: true,
    },
  ])('retries $failure: $expected', ({ error, expected }) => {
    expect(shouldRetry(0, error)).toBe(expected);
  });

  it.each([
    { failureCount: 0, retried: true },
    { failureCount: 2, retried: true },
    { failureCount: 3, retried: false },
  ])(
    'retries a transient failure after $failureCount failures: $retried',
    ({ failureCount, retried }) => {
      expect(shouldRetry(failureCount, new ApiError(503, ErrorCodes.INTERNAL, ''))).toBe(retried);
    }
  );

  it.each([
    { failureCount: 0, random: 1, expected: 1000 },
    { failureCount: 2, random: 1, expected: 4000 },
    { failureCount: 2, random: 0.5, expected: 2000 },
    { failureCount: 10, random: 1, expected: 30_000 },
    { failureCount: 3, random: 0, expected: 0 },
  ])(
    'backs off $expected ms after $failureCount failures at jitter $random',
    ({ failureCount, random, expected }) => {
      expect(retryDelay(failureCount, new Error('x'), () => random)).toBe(expected);
    }
  );

  it('waits as long as the server asked', () => {
    const limited = new ApiError(429, ErrorCodes.RATE_LIMITED, '', undefined, 12_000);

    expect(retryDelay(0, limited, () => 0)).toBe(12_000);
  });
});

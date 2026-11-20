import { ApiContractError, ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { apiRetryPolicy } from '../retry-policy';

const { shouldRetry, retryDelay } = apiRetryPolicy;

describe('@vp/queries: the API retry policy', () => {
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

  it('waits as long as the server asked', () => {
    const limited = new ApiError(429, ErrorCodes.RATE_LIMITED, '', undefined, 12_000);

    expect(retryDelay(0, limited, () => 0)).toBe(12_000);
  });
});

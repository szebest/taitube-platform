import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { failureCode } from '../failure-code';

describe('@vp/queries: failureCode', () => {
  it.each([
    {
      failure: 'a classified problem',
      error: new ApiError(404, ErrorCodes.VIDEO_NOT_FOUND, ''),
      expected: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      failure: 'an unclassified response',
      error: new ApiError(502, 'HTTP_ERROR', ''),
      expected: ErrorCodes.INTERNAL,
    },
    {
      failure: 'a dropped connection',
      error: new TypeError('fetch failed'),
      expected: ErrorCodes.INTERNAL,
    },
    { failure: 'a thrown string', error: 'boom', expected: ErrorCodes.INTERNAL },
  ])('reads $failure as $expected', ({ error, expected }) => {
    expect(failureCode(error)).toBe(expected);
  });
});

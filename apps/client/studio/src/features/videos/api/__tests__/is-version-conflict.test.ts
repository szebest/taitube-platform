import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { isVersionConflict } from '../is-version-conflict';

const apiError = (code: string) => new ApiError(409, code, 'x');

describe('apps/client/studio: isVersionConflict', () => {
  it.each([
    {
      name: 'a version conflict from the API',
      error: apiError(ErrorCodes.VERSION_CONFLICT),
      expected: true,
    },
    { name: 'another error from the API', error: apiError(ErrorCodes.FORBIDDEN), expected: false },
    { name: 'an error that is not the API', error: new Error('offline'), expected: false },
  ])('reads $name as $expected', ({ error, expected }) => {
    expect(isVersionConflict(error)).toBe(expected);
  });
});

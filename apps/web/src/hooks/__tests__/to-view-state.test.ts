import { ErrorCodes } from '@vp/errors';
import { err, ok } from '@vp/result';
import { invalidVideoTitle, unsupportedContentType, uploadTooLarge } from '@vp/validation';
import { toViewState } from '../to-view-state';

describe('apps/web: toViewState', () => {
  it('carries the value of a success as its data', () => {
    expect(toViewState(ok({ title: 'Launch day' }))).toEqual({
      status: 'success',
      data: { title: 'Launch day' },
    });
  });

  it.each([
    {
      shape: 'a field failure with its bounds',
      failure: invalidVideoTitle({ minLength: 1, maxLength: 200 }),
    },
    {
      shape: 'a failure with a code of its own',
      failure: uploadTooLarge(2048, 1024),
    },
    {
      shape: 'a failure listing what is allowed',
      failure: unsupportedContentType('video/avi', ['video/mp4']),
    },
    {
      shape: 'a failure that names no field',
      failure: { code: ErrorCodes.VIDEO_NOT_FOUND, message: 'No such video' },
    },
  ])('keeps $shape as the failure', ({ failure }) => {
    expect(toViewState(err(failure))).toEqual({ status: 'error', failure });
  });
});

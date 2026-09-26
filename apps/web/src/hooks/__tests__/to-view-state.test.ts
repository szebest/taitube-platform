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
      fieldErrors: { title: 'title must be between 1 and 200 characters' },
    },
    {
      shape: 'a failure with a code of its own',
      failure: uploadTooLarge(2048, 1024),
      fieldErrors: { sizeBytes: 'File exceeds the maximum upload size of 1024 bytes' },
    },
    {
      shape: 'a failure listing what is allowed',
      failure: unsupportedContentType('video/avi', ['video/mp4']),
      fieldErrors: { contentType: 'Content type video/avi is not supported. Allowed: video/mp4' },
    },
    {
      shape: 'a failure that names no field',
      failure: { code: ErrorCodes.VIDEO_NOT_FOUND, message: 'No such video' },
      fieldErrors: {},
    },
  ])('keeps $shape as the failure and files its message by field', ({ failure, fieldErrors }) => {
    expect(toViewState(err(failure))).toEqual({ status: 'error', failure, fieldErrors });
  });
});

import { ErrorCodes } from '../error-codes';
import { isInputFailure } from '../failure';
import { PermanentError, TransientError } from '../pipeline-error';
import { mediaFailure, mediaFailureFrom } from '../pipeline-failures';

describe('@vp/errors: media failures', () => {
  it('names the stage that rejected the media and stays off the wire', () => {
    const failure = mediaFailure('probe', ErrorCodes.CORRUPT_CONTAINER, 'moov atom missing');

    expect(failure).toEqual({
      code: ErrorCodes.CORRUPT_CONTAINER,
      message: 'moov atom missing',
      stage: 'probe',
    });
    expect(isInputFailure(failure)).toBe(false);
  });

  it.each([
    {
      shape: 'a permanent pipeline error',
      cause: new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'av1'),
    },
    {
      shape: 'a transient pipeline error',
      cause: new TransientError(ErrorCodes.FFMPEG_TIMEOUT, 'slow'),
    },
  ])('keeps the code $shape already reported', ({ cause }) => {
    expect(mediaFailureFrom('transcode', cause).code).toBe(cause.code);
  });

  it.each([
    { shape: 'a plain Error', cause: new Error('boom'), message: 'boom' },
    { shape: 'a thrown string', cause: 'boom', message: 'boom' },
    {
      shape: 'a pipeline error carrying a code outside the vocabulary',
      cause: new PermanentError('MADE_UP', 'boom'),
      message: 'boom',
    },
  ])('falls back for $shape', ({ cause, message }) => {
    expect(mediaFailureFrom('probe', cause)).toEqual({
      code: ErrorCodes.FFMPEG_FAILED,
      message,
      stage: 'probe',
    });
  });

  it('takes the fallback code the caller supplies', () => {
    expect(mediaFailureFrom('probe', new Error('x'), ErrorCodes.CORRUPT_CONTAINER).code).toBe(
      ErrorCodes.CORRUPT_CONTAINER
    );
  });
});

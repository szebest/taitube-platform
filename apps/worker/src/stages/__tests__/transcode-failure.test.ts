import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { transcodeFailure } from '../transcode-failure';

describe('apps/worker/stages: transcode failure classification', () => {
  it.each([
    {
      shape: 'an ENOSPC errno from node:fs',
      cause: Object.assign(new Error('write failed'), { code: 'ENOSPC' }),
    },
    {
      shape: 'the DISK_FULL FFmpeg read off its stderr',
      cause: new TransientError(ErrorCodes.DISK_FULL, 'No space left on device'),
    },
  ])('reads $shape as DISK_FULL', ({ cause }) => {
    expect(transcodeFailure('720p', cause)).toMatchObject({
      code: ErrorCodes.DISK_FULL,
      stage: 'transcode-720p',
    });
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
    expect(transcodeFailure('1080p', cause).code).toBe(cause.code);
  });

  it('falls back to FFMPEG_FAILED for anything unclassified, whatever its message says', () => {
    expect(transcodeFailure('480p', new Error('No space left on device'))).toEqual({
      code: ErrorCodes.FFMPEG_FAILED,
      message: 'No space left on device',
      stage: 'transcode-480p',
    });
  });
});

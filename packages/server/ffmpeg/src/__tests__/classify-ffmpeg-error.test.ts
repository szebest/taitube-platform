import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { classifyFfmpegError } from '../classify-ffmpeg-error';

describe('@vp/ffmpeg: classifyFfmpegError', () => {
  it.each([
    {
      exit: 137,
      signal: null,
      stderr: 'Killed',
      type: TransientError,
      code: ErrorCodes.FFMPEG_OOM,
    },
    {
      exit: null,
      signal: 'SIGTERM',
      stderr: 'Terminated',
      type: TransientError,
      code: ErrorCodes.FFMPEG_TIMEOUT,
    },
    {
      exit: 1,
      signal: null,
      stderr: '[mov,mp4 @ 0x123] Invalid data found when processing input',
      type: PermanentError,
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      exit: 1,
      signal: null,
      stderr: 'av_interleaved_write_frame(): No space left on device',
      type: TransientError,
      code: ErrorCodes.DISK_FULL,
    },
    {
      exit: 1,
      signal: null,
      stderr: 'Unknown error during encode',
      type: TransientError,
      code: ErrorCodes.FFMPEG_FAILED,
    },
  ])('reads exit $exit / $signal as $code', ({ exit, signal, stderr, type, code }) => {
    const classified = classifyFfmpegError(exit, signal, stderr);

    expect(classified).toBeInstanceOf(type);
    expect((classified as TransientError).code).toBe(code);
  });

  it.each([
    'av_interleaved_write_frame(): No space left on device\nError writing trailer: No space left on device',
    'Error: ENOSPC: cannot write segment to disk',
  ])('classifies %j as TransientError with hint DISK_FULL', (stderr) => {
    const err = classifyFfmpegError(1, null, stderr);

    expect(err).toBeInstanceOf(TransientError);
    expect((err as TransientError).code).toBe(ErrorCodes.DISK_FULL);
    expect((err as TransientError).details?.['hint']).toBe('DISK_FULL');
  });
});

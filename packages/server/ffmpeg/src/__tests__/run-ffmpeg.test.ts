import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { classifyFfmpegError, runFfmpeg } from '../run-ffmpeg';

const LIMITS = { killGraceMs: 200, stderrTailLines: 20 };

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
});

describe('@vp/ffmpeg: runFfmpeg', () => {
  it('stops the process when its signal aborts, and rejects as aborted rather than timed out', async () => {
    const lease = new AbortController();
    const running = runFfmpeg({
      ffmpegPath: 'sleep',
      stage: 'transcode',
      args: ['5'],
      timeoutMs: 10_000,
      limits: LIMITS,
      signal: lease.signal,
    });

    lease.abort();

    await expect(running).rejects.toMatchObject({
      code: ErrorCodes.FFMPEG_FAILED,
      message: 'FFmpeg transcode was aborted',
    });
  });

  it('stops at once for a signal that is already aborted', async () => {
    await expect(
      runFfmpeg({
        ffmpegPath: 'sleep',
        stage: 'thumbnail',
        args: ['5'],
        timeoutMs: 10_000,
        limits: LIMITS,
        signal: AbortSignal.abort(),
      })
    ).rejects.toMatchObject({ message: 'FFmpeg thumbnail was aborted' });
  });
});

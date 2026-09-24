import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';

export function classifyFfmpegError(
  exitCode: number | null,
  signal: string | null,
  stderr: string
): Error {
  const lowerStderr = stderr.toLowerCase();

  // Exit 137 is the kernel's OOM kill.
  if (exitCode === 137 || signal === 'SIGKILL') {
    return new TransientError(
      ErrorCodes.FFMPEG_OOM,
      `FFmpeg killed due to Out-Of-Memory (exit 137 / SIGKILL): ${stderr.slice(-300)}`
    );
  }

  if (signal === 'SIGTERM' || signal === 'SIGALRM') {
    return new TransientError(
      ErrorCodes.FFMPEG_TIMEOUT,
      `FFmpeg process timed out: ${stderr.slice(-300)}`
    );
  }

  if (
    lowerStderr.includes('no space left on device') ||
    lowerStderr.includes('enospc') ||
    lowerStderr.includes('disk full')
  ) {
    return new TransientError(
      ErrorCodes.DISK_FULL,
      `Disk full during FFmpeg transcode: ${stderr.slice(-300)}`,
      { hint: 'DISK_FULL' }
    );
  }

  if (
    lowerStderr.includes('invalid data found when processing input') ||
    lowerStderr.includes('could not find codec parameters') ||
    lowerStderr.includes('moov atom not found')
  ) {
    return new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `FFmpeg failed to decode input container: ${stderr.slice(-300)}`
    );
  }

  return new TransientError(
    ErrorCodes.FFMPEG_FAILED,
    `FFmpeg transcode failed (exit code ${exitCode}, signal ${signal}): ${stderr.slice(-300)}`
  );
}

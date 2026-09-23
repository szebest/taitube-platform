import { ErrorCodes, type MediaFailure, mediaFailure, mediaFailureFrom } from '@vp/errors';

/**
 * A full disk is transient - the next pod has room. FFmpeg reports it as a `DISK_FULL` pipeline
 * error read from its stderr; `node:fs` reports it as an `ENOSPC` errno, which is translated here.
 * Everything else keeps whatever code it already reported.
 */
export function transcodeFailure(rendition: string, cause: unknown): MediaFailure {
  const stage = `transcode-${rendition}`;
  return (cause as NodeJS.ErrnoException | null)?.code === 'ENOSPC'
    ? mediaFailure(
        stage,
        ErrorCodes.DISK_FULL,
        `ENOSPC disk exhaustion: ${(cause as Error).message}`
      )
    : mediaFailureFrom(stage, cause);
}

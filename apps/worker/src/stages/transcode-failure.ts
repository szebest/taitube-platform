import { ErrorCodes, type MediaFailure, mediaFailure, mediaFailureFrom } from '@vp/errors';

/**
 * A full disk arrives from `node:fs` or from FFmpeg as an ENOSPC, never as a pipeline error, and it
 * is transient - the next pod has room. Everything else keeps whatever code it already reported.
 */
export function transcodeFailure(rendition: string, cause: unknown): MediaFailure {
  const stage = `transcode-${rendition}`;
  return isDiskFull(cause)
    ? mediaFailure(stage, ErrorCodes.DISK_FULL, `ENOSPC disk exhaustion: ${messageOf(cause)}`)
    : mediaFailureFrom(stage, cause);
}

function messageOf(cause: unknown): string {
  return (cause as Error)?.message ?? String(cause);
}

function isDiskFull(cause: unknown): boolean {
  const details = cause as { code?: string; hint?: string } | null;
  if (details?.code === 'ENOSPC' || details?.hint === 'DISK_FULL') return true;

  const message = messageOf(cause);
  return message.includes('ENOSPC') || message.toLowerCase().includes('no space left on device');
}

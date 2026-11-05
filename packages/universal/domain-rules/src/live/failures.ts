import { ErrorCodes, type Failure } from '@vp/errors';

export type LiveStreamNotFound = Failure<
  typeof ErrorCodes.LIVE_STREAM_NOT_FOUND,
  { liveStreamId: string }
>;

export type LiveStreamNotLive = Failure<
  typeof ErrorCodes.LIVE_STREAM_NOT_LIVE,
  { liveStreamId: string }
>;

/** Why the ingest gateway was told no; for the log, never for the publisher. */
type IngestRefusal =
  | 'hook-secret'
  | 'unknown-key'
  | 'not-idle'
  | 'stopping'
  | 'reader'
  | 'action';

export type LiveIngestRefused = Failure<
  typeof ErrorCodes.LIVE_INGEST_REFUSED,
  { reason: IngestRefusal }
>;

export function liveStreamNotFound(liveStreamId: string): LiveStreamNotFound {
  return { code: ErrorCodes.LIVE_STREAM_NOT_FOUND, message: 'Live stream not found', liveStreamId };
}

export function liveStreamNotLive(liveStreamId: string): LiveStreamNotLive {
  return {
    code: ErrorCodes.LIVE_STREAM_NOT_LIVE,
    message: 'Live stream is not live',
    liveStreamId,
  };
}

export function liveIngestRefused(reason: IngestRefusal): LiveIngestRefused {
  return { code: ErrorCodes.LIVE_INGEST_REFUSED, message: 'Ingest refused', reason };
}

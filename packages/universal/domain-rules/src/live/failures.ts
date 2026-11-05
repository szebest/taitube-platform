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
type IngestRefusal = 'hook-secret' | 'unknown-key' | 'not-idle' | 'stopping' | 'reader' | 'action';

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

export type LiveChatClosed = Failure<typeof ErrorCodes.LIVE_CHAT_CLOSED, { liveStreamId: string }>;

export type LiveChatSubscribersOnly = Failure<
  typeof ErrorCodes.LIVE_CHAT_SUBSCRIBERS_ONLY,
  { liveStreamId: string }
>;

export type LiveChatSlowMode = Failure<
  typeof ErrorCodes.LIVE_CHAT_SLOW_MODE,
  { retryAfterSeconds: number }
>;

/** Unknown, spent or expired: a one-time chat token answers once, inside its time to live. */
export type LiveChatTicketInvalid = Failure<typeof ErrorCodes.LIVE_CHAT_TICKET_INVALID>;

export function liveChatClosed(liveStreamId: string): LiveChatClosed {
  return { code: ErrorCodes.LIVE_CHAT_CLOSED, message: 'Chat is closed', liveStreamId };
}

export function liveChatSubscribersOnly(liveStreamId: string): LiveChatSubscribersOnly {
  return {
    code: ErrorCodes.LIVE_CHAT_SUBSCRIBERS_ONLY,
    message: 'Chat is for subscribers only',
    liveStreamId,
  };
}

export function liveChatSlowMode(retryAfterSeconds: number): LiveChatSlowMode {
  return { code: ErrorCodes.LIVE_CHAT_SLOW_MODE, message: 'Sending too fast', retryAfterSeconds };
}

export function liveChatTicketInvalid(): LiveChatTicketInvalid {
  return { code: ErrorCodes.LIVE_CHAT_TICKET_INVALID, message: 'Chat ticket is not valid' };
}

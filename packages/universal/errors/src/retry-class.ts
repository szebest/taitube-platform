import { type ErrorCode, ErrorCodes } from './error-codes';

export type RetryClass = 'permanent' | 'transient';

/**
 * ADR-18's classification, declared once per code instead of judged at each throw site. The
 * decision to retry still belongs to the queue boundary; what a code *is* belongs with the code.
 * Declared over the whole `ErrorCode` union, so adding a code fails to compile until it is
 * classified.
 */
export const RETRY_CLASS: Readonly<Record<ErrorCode, RetryClass>> = {
  [ErrorCodes.UPLOAD_TOO_LARGE]: 'permanent',
  [ErrorCodes.UPLOAD_SIZE_MISMATCH]: 'permanent',
  [ErrorCodes.UNSUPPORTED_CONTENT_TYPE]: 'permanent',
  [ErrorCodes.UPLOAD_EXPIRED]: 'permanent',
  [ErrorCodes.UPLOAD_NOT_OPEN]: 'permanent',
  [ErrorCodes.QUOTA_EXCEEDED]: 'permanent',
  [ErrorCodes.VIDEO_NOT_FOUND]: 'permanent',
  [ErrorCodes.DLQ_ENTRY_NOT_FOUND]: 'permanent',
  [ErrorCodes.VERSION_CONFLICT]: 'permanent',
  [ErrorCodes.FORBIDDEN]: 'permanent',
  [ErrorCodes.UNAUTHORIZED]: 'permanent',
  [ErrorCodes.VALIDATION_FAILED]: 'permanent',
  [ErrorCodes.INVALID_CURSOR]: 'permanent',
  [ErrorCodes.CATEGORY_NOT_FOUND]: 'permanent',
  [ErrorCodes.CATEGORY_SLUG_CONFLICT]: 'permanent',
  [ErrorCodes.CATEGORY_IN_USE]: 'permanent',
  [ErrorCodes.CHANNEL_NOT_FOUND]: 'permanent',
  [ErrorCodes.HANDLE_ALREADY_TAKEN]: 'permanent',
  [ErrorCodes.INVALID_HANDLE_FORMAT]: 'permanent',
  [ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF]: 'permanent',
  [ErrorCodes.UNSUPPORTED_CODEC]: 'permanent',
  [ErrorCodes.CORRUPT_CONTAINER]: 'permanent',
  [ErrorCodes.DURATION_EXCEEDED]: 'permanent',
  [ErrorCodes.SOURCE_MISSING]: 'permanent',
  [ErrorCodes.ORPHANED]: 'permanent',
  [ErrorCodes.FORMAT_UNSUPPORTED_LOCALE]: 'permanent',
  [ErrorCodes.FORMAT_UNKNOWN_OPTION]: 'permanent',
  [ErrorCodes.FORMAT_WRONG_KIND]: 'permanent',
  [ErrorCodes.FORMAT_UNRENDERABLE]: 'permanent',
  [ErrorCodes.RATE_LIMITED]: 'transient',
  [ErrorCodes.DATABASE_UNAVAILABLE]: 'transient',
  [ErrorCodes.CACHE_UNAVAILABLE]: 'transient',
  [ErrorCodes.QUEUE_UNAVAILABLE]: 'transient',
  [ErrorCodes.STORAGE_UNAVAILABLE]: 'transient',
  [ErrorCodes.FFMPEG_FAILED]: 'transient',
  [ErrorCodes.FFMPEG_OOM]: 'transient',
  [ErrorCodes.FFMPEG_TIMEOUT]: 'transient',
  [ErrorCodes.SEGMENT_VERIFY_FAILED]: 'transient',
  [ErrorCodes.DISK_FULL]: 'transient',
  [ErrorCodes.INTERNAL]: 'transient',
};

/** ADR-18's "when unsure, retry a little, then park" applies to anything not in the table. */
export function retryClass(code: ErrorCode | string): RetryClass {
  return RETRY_CLASS[code as ErrorCode] ?? 'transient';
}

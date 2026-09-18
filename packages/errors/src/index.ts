export const ErrorCodes = {
  // API Errors
  UPLOAD_TOO_LARGE: 'UPLOAD_TOO_LARGE',
  UPLOAD_SIZE_MISMATCH: 'UPLOAD_SIZE_MISMATCH',
  UNSUPPORTED_CONTENT_TYPE: 'UNSUPPORTED_CONTENT_TYPE',
  UPLOAD_EXPIRED: 'UPLOAD_EXPIRED',
  UPLOAD_NOT_OPEN: 'UPLOAD_NOT_OPEN',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  DLQ_ENTRY_NOT_FOUND: 'DLQ_ENTRY_NOT_FOUND',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_SLUG_CONFLICT: 'CATEGORY_SLUG_CONFLICT',
  CATEGORY_IN_USE: 'CATEGORY_IN_USE',
  INTERNAL: 'INTERNAL',
  // Pipeline Errors
  UNSUPPORTED_CODEC: 'UNSUPPORTED_CODEC',
  CORRUPT_CONTAINER: 'CORRUPT_CONTAINER',
  DURATION_EXCEEDED: 'DURATION_EXCEEDED',
  SOURCE_MISSING: 'SOURCE_MISSING',
  FFMPEG_FAILED: 'FFMPEG_FAILED',
  FFMPEG_OOM: 'FFMPEG_OOM',
  FFMPEG_TIMEOUT: 'FFMPEG_TIMEOUT',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  SEGMENT_VERIFY_FAILED: 'SEGMENT_VERIFY_FAILED',
  DISK_FULL: 'DISK_FULL',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ErrorDetail {
  code: ErrorCode | string;
  message: string;
}

export abstract class PipelineError extends Error {
  abstract readonly isRetryable: boolean;

  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PermanentError extends PipelineError {
  readonly isRetryable = false;

  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'PermanentError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TransientError extends PipelineError {
  readonly isRetryable = true;
}

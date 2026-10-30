import { type ErrorCode, ErrorCodes, RETRY_CLASS } from '@vp/errors';
import type { ErrorStateKind } from '@vp/components';
import { ERROR_COPY } from '@vp/messages';
import { assertNever } from '@vp/result';

export interface FailurePresentation {
  kind: ErrorStateKind;
  /** The catalogue key for the sentence under the title. */
  copy: (typeof ERROR_COPY)[ErrorCode];
  /** Asking again can succeed, so the page offers a retry. */
  retryable: boolean;
}

function kindOf(code: ErrorCode): ErrorStateKind {
  switch (code) {
    case ErrorCodes.VIDEO_NOT_FOUND:
    case ErrorCodes.DLQ_ENTRY_NOT_FOUND:
    case ErrorCodes.ROUTE_NOT_FOUND:
    case ErrorCodes.CATEGORY_NOT_FOUND:
    case ErrorCodes.CHANNEL_NOT_FOUND:
    case ErrorCodes.COMMENT_NOT_FOUND:
    case ErrorCodes.REPORT_NOT_FOUND:
    case ErrorCodes.PLAYLIST_NOT_FOUND:
    case ErrorCodes.PLAYLIST_ITEM_NOT_FOUND:
    case ErrorCodes.SEARCH_HISTORY_NOT_FOUND:
    case ErrorCodes.CAPTION_NOT_FOUND:
    case ErrorCodes.CLIP_NOT_FOUND:
      return 'not-found';
    case ErrorCodes.FORBIDDEN:
      return 'forbidden';
    case ErrorCodes.UNAUTHORIZED:
      return 'unauthorised';
    case ErrorCodes.RATE_LIMITED:
      return 'rate-limited';
    case ErrorCodes.INTERNAL:
    case ErrorCodes.DATABASE_UNAVAILABLE:
    case ErrorCodes.CACHE_UNAVAILABLE:
    case ErrorCodes.QUEUE_UNAVAILABLE:
    case ErrorCodes.STORAGE_UNAVAILABLE:
      return 'server';
    case ErrorCodes.UPLOAD_TOO_LARGE:
    case ErrorCodes.UPLOAD_SIZE_MISMATCH:
    case ErrorCodes.UNSUPPORTED_CONTENT_TYPE:
    case ErrorCodes.UPLOAD_EXPIRED:
    case ErrorCodes.UPLOAD_NOT_OPEN:
    case ErrorCodes.QUOTA_EXCEEDED:
    case ErrorCodes.VERSION_CONFLICT:
    case ErrorCodes.VALIDATION_FAILED:
    case ErrorCodes.INVALID_CURSOR:
    case ErrorCodes.CATEGORY_SLUG_CONFLICT:
    case ErrorCodes.CATEGORY_IN_USE:
    case ErrorCodes.HANDLE_ALREADY_TAKEN:
    case ErrorCodes.INVALID_HANDLE_FORMAT:
    case ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF:
    case ErrorCodes.COMMENT_NOT_PINNABLE:
    case ErrorCodes.COMMENT_ALREADY_REPORTED:
    case ErrorCodes.REPORT_ALREADY_RESOLVED:
    case ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE:
    case ErrorCodes.UNSUPPORTED_CODEC:
    case ErrorCodes.CORRUPT_CONTAINER:
    case ErrorCodes.DURATION_EXCEEDED:
    case ErrorCodes.SOURCE_MISSING:
    case ErrorCodes.ORPHANED:
    case ErrorCodes.FORMAT_UNSUPPORTED_LOCALE:
    case ErrorCodes.FORMAT_UNKNOWN_OPTION:
    case ErrorCodes.FORMAT_WRONG_KIND:
    case ErrorCodes.FORMAT_UNRENDERABLE:
    case ErrorCodes.FFMPEG_FAILED:
    case ErrorCodes.FFMPEG_OOM:
    case ErrorCodes.FFMPEG_TIMEOUT:
    case ErrorCodes.SEGMENT_VERIFY_FAILED:
    case ErrorCodes.DISK_FULL:
    case ErrorCodes.WHISPER_FAILED:
    case ErrorCodes.WHISPER_KILLED:
    case ErrorCodes.WHISPER_TIMEOUT:
    case ErrorCodes.WHISPER_MODEL_INVALID:
    case ErrorCodes.WHISPER_INPUT_REJECTED:
    case ErrorCodes.NO_AUDIO_STREAM:
    case ErrorCodes.CAPTION_TRACK_LIMIT:
    case ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED:
      return 'generic';
    default:
      return assertNever(code, 'kindOf');
  }
}

/** What a failed page or section tells the viewer, read off the code the API answered with. */
export function present(failure: { code: ErrorCode }): FailurePresentation {
  return {
    kind: kindOf(failure.code),
    copy: ERROR_COPY[failure.code],
    retryable: RETRY_CLASS[failure.code] === 'transient',
  };
}

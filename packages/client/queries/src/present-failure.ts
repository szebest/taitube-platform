import type { ErrorStateKind } from '@kit/components';
import { assertNever } from '@kit/result';
import { type ErrorCode, ErrorCodes, RETRY_CLASS } from '@vp/errors';
import { ERROR_COPY } from '@vp/shared-messages';

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
    case ErrorCodes.POST_NOT_FOUND:
    case ErrorCodes.THREAD_NOT_FOUND:
    case ErrorCodes.PLAYLIST_ITEM_NOT_FOUND:
    case ErrorCodes.SEARCH_HISTORY_NOT_FOUND:
    case ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND:
    case ErrorCodes.CAPTION_NOT_FOUND:
    case ErrorCodes.CLIP_NOT_FOUND:
    case ErrorCodes.REVISION_NOT_FOUND:
    case ErrorCodes.CORRECTION_NOT_FOUND:
    case ErrorCodes.SHARE_LINK_NOT_FOUND:
    case ErrorCodes.EXPERIMENT_NOT_FOUND:
    case ErrorCodes.PICK_NOT_FOUND:
    case ErrorCodes.WEBHOOK_NOT_FOUND:
    case ErrorCodes.EXPORT_NOT_FOUND:
    case ErrorCodes.API_TOKEN_NOT_FOUND:
    case ErrorCodes.LIVE_STREAM_NOT_FOUND:
    case ErrorCodes.WATCH_PARTY_NOT_FOUND:
    case ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND:
    case ErrorCodes.CHANNEL_INVITE_NOT_FOUND:
    case ErrorCodes.CHANNEL_MEMBER_NOT_FOUND:
    case ErrorCodes.RESTRICTION_NOT_FOUND:
    case ErrorCodes.SAVED_REPLY_NOT_FOUND:
    case ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND:
    case ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND:
      return 'not-found';
    case ErrorCodes.FORBIDDEN:
    case ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED:
    case ErrorCodes.CHANNEL_NOT_OWNED:
    case ErrorCodes.API_TOKEN_SCOPE_MISSING:
    case ErrorCodes.LIVE_CHAT_SUBSCRIBERS_ONLY:
    case ErrorCodes.COMMENTS_BANNED:
    case ErrorCodes.COMMENTS_DISABLED:
    case ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY:
    case ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW:
    case ErrorCodes.WATCH_PARTY_BANNED:
    case ErrorCodes.WATCH_PARTY_GUESTS_OFF:
    case ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED:
    case ErrorCodes.WATCH_PARTY_PASSWORD_INVALID:
    case ErrorCodes.VIDEO_PASSWORD_REQUIRED:
    case ErrorCodes.VIDEO_PASSWORD_INVALID:
    case ErrorCodes.WATCH_PARTY_INVITE_INVALID:
    case ErrorCodes.WATCH_PARTY_PERMISSION_MISSING:
    case ErrorCodes.WATCH_PARTY_ROLE_ESCALATION:
    case ErrorCodes.WATCH_PARTY_ROLE_PROTECTED:
    case ErrorCodes.WATCH_PARTY_CHAT_OFF:
    case ErrorCodes.PLAYLIST_INVITE_INVALID:
      return 'forbidden';
    case ErrorCodes.UNAUTHORIZED:
    case ErrorCodes.LIVE_INGEST_REFUSED:
    case ErrorCodes.LIVE_CHAT_TICKET_INVALID:
    case ErrorCodes.WATCH_PARTY_TICKET_INVALID:
    case ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID:
      return 'unauthorised';
    case ErrorCodes.RATE_LIMITED:
    case ErrorCodes.LIVE_CHAT_SLOW_MODE:
    case ErrorCodes.COMMENTS_SLOW_MODE:
    case ErrorCodes.EXPORT_DAILY_LIMIT:
    case ErrorCodes.POST_DAILY_LIMIT:
    case ErrorCodes.POST_DRAFT_LIMIT:
    case ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED:
    case ErrorCodes.WATCH_PARTY_SLOW_MODE:
      return 'rate-limited';
    case ErrorCodes.INTERNAL:
    case ErrorCodes.DATABASE_UNAVAILABLE:
    case ErrorCodes.CACHE_UNAVAILABLE:
    case ErrorCodes.QUEUE_UNAVAILABLE:
    case ErrorCodes.STORAGE_UNAVAILABLE:
    case ErrorCodes.LIVE_GATEWAY_UNAVAILABLE:
    case ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE:
    case ErrorCodes.LIVE_INGEST_UNAVAILABLE:
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
    case ErrorCodes.SCREENING_REJECTED:
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
    case ErrorCodes.SCREEN_MODEL_INVALID:
    case ErrorCodes.SCREEN_MODEL_FAILED:
    case ErrorCodes.WHISPER_INPUT_REJECTED:
    case ErrorCodes.NO_AUDIO_STREAM:
    case ErrorCodes.CAPTION_TRACK_LIMIT:
    case ErrorCodes.CORRECTION_LIMIT:
    case ErrorCodes.SHARE_LINK_EXPIRED:
    case ErrorCodes.SHARE_LINK_LIMIT:
    case ErrorCodes.VIDEO_PASSWORDS_OFF:
    case ErrorCodes.EXPERIMENT_LIMIT:
    case ErrorCodes.EXPERIMENT_NOT_RUNNING:
    case ErrorCodes.GENERATION_IN_PROGRESS:
    case ErrorCodes.REPLACEMENT_NOT_UPLOADED:
    case ErrorCodes.NO_EDIT_TO_REVERT:
    case ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED:
    case ErrorCodes.PICK_WINDOW_OVERLAP:
    case ErrorCodes.WEBHOOK_LIMIT_REACHED:
    case ErrorCodes.CHANNEL_LIMIT_REACHED:
    case ErrorCodes.EXPORT_IN_PROGRESS:
    case ErrorCodes.EXPORT_TOO_LARGE:
    case ErrorCodes.API_TOKEN_LIMIT_REACHED:
    case ErrorCodes.API_TOKEN_WITH_SESSION:
    case ErrorCodes.WEBHOOK_DELIVERY_FAILED:
    case ErrorCodes.WEBHOOK_DELIVERY_REJECTED:
    case ErrorCodes.OEMBED_URL_UNSUPPORTED:
    case ErrorCodes.OEMBED_FORMAT_UNSUPPORTED:
    case ErrorCodes.LIVE_STREAM_NOT_LIVE:
    case ErrorCodes.LIVE_CHAT_CLOSED:
    case ErrorCodes.WATCH_PARTY_CLOSED:
    case ErrorCodes.WATCH_PARTY_FULL:
    case ErrorCodes.WATCH_PARTY_LIMIT_REACHED:
    case ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE:
    case ErrorCodes.WATCH_PARTY_QUEUE_FULL:
    case ErrorCodes.WATCH_PARTY_STATE_STALE:
    case ErrorCodes.WATCH_PARTY_ROLE_LIMIT:
    case ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL:
    case ErrorCodes.CHANNEL_INVITE_NOT_PENDING:
    case ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING:
    case ErrorCodes.CHANNEL_MEMBER_EXISTS:
    case ErrorCodes.CHANNEL_OWNER_IMMUTABLE:
    case ErrorCodes.MODERATION_NOT_APPLICABLE:
    case ErrorCodes.CANNOT_RESTRICT_MEMBER:
    case ErrorCodes.SAVED_REPLY_LIMIT:
    case ErrorCodes.HANDLE_CHANGE_TOO_SOON:
    case ErrorCodes.HANDLE_RESERVED:
    case ErrorCodes.INVALID_SPOTLIGHT_VIDEO:
    case ErrorCodes.IMAGE_TOO_SMALL:
    case ErrorCodes.IMAGE_UPLOAD_NOT_FOUND:
    case ErrorCodes.SERIES_VIDEO_NOT_OWNED:
    case ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS:
    case ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT:
    case ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE:
    case ErrorCodes.PLAYLIST_IS_SMART:
    case ErrorCodes.PLAYLIST_NOT_SMART:
    case ErrorCodes.PLAYLIST_HAS_COLLABORATORS:
    case ErrorCodes.PLAYLIST_PIN_LIMIT:
    case ErrorCodes.POST_SHARE_NOT_PUBLIC:
    case ErrorCodes.POST_ALREADY_VOTED:
    case ErrorCodes.POST_POLL_CLOSED:
    case ErrorCodes.POST_POLL_LOCKED:
    case ErrorCodes.POST_PIN_LIMIT:
    case ErrorCodes.POST_SCHEDULE_INVALID:
    case ErrorCodes.POST_IMAGE_NOT_READY:
    case ErrorCodes.THREAD_LIMIT:
    case ErrorCodes.THREAD_PIN_LIMIT:
    case ErrorCodes.THREAD_ANCHOR_INVALID:
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

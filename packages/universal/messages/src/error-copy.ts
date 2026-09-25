import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { ArgumentFreeKey } from './catalogue';

/**
 * The words a person sees for each failure code. Declared over the whole `ErrorCode` union, so a
 * new code fails to compile until someone writes its copy.
 */
export const ERROR_COPY: Readonly<Record<ErrorCode, ArgumentFreeKey>> = {
  [ErrorCodes.UPLOAD_TOO_LARGE]: 'errors.uploadTooLarge',
  [ErrorCodes.UPLOAD_SIZE_MISMATCH]: 'errors.uploadSizeMismatch',
  [ErrorCodes.UNSUPPORTED_CONTENT_TYPE]: 'errors.unsupportedContentType',
  [ErrorCodes.UPLOAD_EXPIRED]: 'errors.uploadExpired',
  [ErrorCodes.UPLOAD_NOT_OPEN]: 'errors.uploadNotOpen',
  [ErrorCodes.QUOTA_EXCEEDED]: 'errors.quotaExceeded',
  [ErrorCodes.VIDEO_NOT_FOUND]: 'errors.videoNotFound',
  [ErrorCodes.DLQ_ENTRY_NOT_FOUND]: 'errors.dlqEntryNotFound',
  [ErrorCodes.VERSION_CONFLICT]: 'errors.versionConflict',
  [ErrorCodes.FORBIDDEN]: 'errors.forbidden',
  [ErrorCodes.RATE_LIMITED]: 'errors.rateLimited',
  [ErrorCodes.UNAUTHORIZED]: 'errors.unauthorized',
  [ErrorCodes.VALIDATION_FAILED]: 'errors.validationFailed',
  [ErrorCodes.INVALID_CURSOR]: 'errors.invalidCursor',
  [ErrorCodes.CATEGORY_NOT_FOUND]: 'errors.categoryNotFound',
  [ErrorCodes.CATEGORY_SLUG_CONFLICT]: 'errors.categorySlugConflict',
  [ErrorCodes.CATEGORY_IN_USE]: 'errors.categoryInUse',
  [ErrorCodes.CHANNEL_NOT_FOUND]: 'errors.channelNotFound',
  [ErrorCodes.HANDLE_ALREADY_TAKEN]: 'errors.handleAlreadyTaken',
  [ErrorCodes.INVALID_HANDLE_FORMAT]: 'errors.invalidHandleFormat',
  [ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF]: 'errors.cannotSubscribeToSelf',
  [ErrorCodes.DATABASE_UNAVAILABLE]: 'errors.databaseUnavailable',
  [ErrorCodes.CACHE_UNAVAILABLE]: 'errors.cacheUnavailable',
  [ErrorCodes.QUEUE_UNAVAILABLE]: 'errors.queueUnavailable',
  [ErrorCodes.INTERNAL]: 'errors.internal',
  [ErrorCodes.FORMAT_UNSUPPORTED_LOCALE]: 'errors.formatUnsupportedLocale',
  [ErrorCodes.FORMAT_UNKNOWN_OPTION]: 'errors.formatUnknownOption',
  [ErrorCodes.FORMAT_WRONG_KIND]: 'errors.formatWrongKind',
  [ErrorCodes.FORMAT_UNRENDERABLE]: 'errors.formatUnrenderable',
  [ErrorCodes.UNSUPPORTED_CODEC]: 'errors.unsupportedCodec',
  [ErrorCodes.CORRUPT_CONTAINER]: 'errors.corruptContainer',
  [ErrorCodes.DURATION_EXCEEDED]: 'errors.durationExceeded',
  [ErrorCodes.SOURCE_MISSING]: 'errors.sourceMissing',
  [ErrorCodes.FFMPEG_FAILED]: 'errors.ffmpegFailed',
  [ErrorCodes.FFMPEG_OOM]: 'errors.ffmpegOom',
  [ErrorCodes.FFMPEG_TIMEOUT]: 'errors.ffmpegTimeout',
  [ErrorCodes.STORAGE_UNAVAILABLE]: 'errors.storageUnavailable',
  [ErrorCodes.SEGMENT_VERIFY_FAILED]: 'errors.segmentVerifyFailed',
  [ErrorCodes.DISK_FULL]: 'errors.diskFull',
  [ErrorCodes.ORPHANED]: 'errors.orphaned',
};

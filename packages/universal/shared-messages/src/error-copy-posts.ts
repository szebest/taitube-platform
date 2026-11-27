import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { SharedArgumentFreeKey } from './catalogue';

export const POST_ERROR_COPY = {
  [ErrorCodes.POST_NOT_FOUND]: 'errors.postNotFound',
  [ErrorCodes.POST_SHARE_NOT_PUBLIC]: 'errors.postShareNotPublic',
  [ErrorCodes.POST_DAILY_LIMIT]: 'errors.postDailyLimit',
  [ErrorCodes.POST_ALREADY_VOTED]: 'errors.postAlreadyVoted',
  [ErrorCodes.POST_POLL_CLOSED]: 'errors.postPollClosed',
  [ErrorCodes.POST_POLL_LOCKED]: 'errors.postPollLocked',
  [ErrorCodes.POST_PIN_LIMIT]: 'errors.postPinLimit',
  [ErrorCodes.POST_DRAFT_LIMIT]: 'errors.postDraftLimit',
  [ErrorCodes.POST_SCHEDULE_INVALID]: 'errors.postScheduleInvalid',
  [ErrorCodes.POST_IMAGE_NOT_READY]: 'errors.postImageNotReady',
} as const satisfies Partial<Record<ErrorCode, SharedArgumentFreeKey>>;

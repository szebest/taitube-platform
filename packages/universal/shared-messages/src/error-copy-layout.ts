import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { SharedArgumentFreeKey } from './catalogue';

export const LAYOUT_ERROR_COPY = {
  [ErrorCodes.LAYOUT_LIMIT_EXCEEDED]: 'errors.layoutLimitExceeded',
  [ErrorCodes.LAYOUT_MARKDOWN_INVALID]: 'errors.layoutMarkdownInvalid',
  [ErrorCodes.LAYOUT_SLUG_INVALID]: 'errors.layoutSlugInvalid',
  [ErrorCodes.LAYOUT_REFERENCE_INVALID]: 'errors.layoutReferenceInvalid',
  [ErrorCodes.LAYOUT_STRUCTURE_INVALID]: 'errors.layoutStructureInvalid',
  [ErrorCodes.LAYOUT_SCHEDULE_INVALID]: 'errors.layoutScheduleInvalid',
  [ErrorCodes.LAYOUT_SCHEDULE_NOT_FOUND]: 'errors.layoutScheduleNotFound',
} as const satisfies Partial<Record<ErrorCode, SharedArgumentFreeKey>>;

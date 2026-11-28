import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { SharedArgumentFreeKey } from './catalogue';

export const LINK_ERROR_COPY = {
  [ErrorCodes.CONTENT_LINK_NOT_FOUND]: 'errors.contentLinkNotFound',
  [ErrorCodes.LINK_PAIR_NOT_ALLOWED]: 'errors.linkPairNotAllowed',
  [ErrorCodes.LINK_RELATION_SAME_CHANNEL]: 'errors.linkRelationSameChannel',
  [ErrorCodes.LINK_TARGET_BLOCKS]: 'errors.linkTargetBlocks',
  [ErrorCodes.LINK_TARGET_NOT_PUBLIC]: 'errors.linkTargetNotPublic',
  [ErrorCodes.LINK_SELF]: 'errors.linkSelf',
  [ErrorCodes.LINK_LOOP]: 'errors.linkLoop',
  [ErrorCodes.LINK_LIMIT]: 'errors.linkLimit',
  [ErrorCodes.LINK_ANCHOR_INVALID]: 'errors.linkAnchorInvalid',
  [ErrorCodes.LINK_EXISTS]: 'errors.linkExists',
  [ErrorCodes.LINK_SUGGESTION_LIMIT]: 'errors.linkSuggestionLimit',
  [ErrorCodes.END_SCREEN_INVALID]: 'errors.endScreenInvalid',
} as const satisfies Partial<Record<ErrorCode, SharedArgumentFreeKey>>;

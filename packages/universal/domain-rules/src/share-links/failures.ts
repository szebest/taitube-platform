import { type Failure } from '@kit/errors';
import {
  MAX_ACTIVE_SHARE_LINKS,
  SHARE_LINK_LABEL_MAX_LENGTH,
  type ShareLinkTargetType,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

export type ShareLinkNotFound = Failure<typeof ErrorCodes.SHARE_LINK_NOT_FOUND, { linkId: string }>;
interface LinkedTarget {
  readonly targetType: ShareLinkTargetType;
  readonly targetId: string;
}

export type ShareLinkExpired = Failure<typeof ErrorCodes.SHARE_LINK_EXPIRED, LinkedTarget>;
export type ShareLinkLimit = Failure<
  typeof ErrorCodes.SHARE_LINK_LIMIT,
  LinkedTarget & { limit: number }
>;
export type InvalidShareLink = InvalidField<{ readonly maxLabelLength: number }>;

export function shareLinkNotFound(linkId: string): ShareLinkNotFound {
  return { code: ErrorCodes.SHARE_LINK_NOT_FOUND, message: 'Share link not found', linkId };
}

export function shareLinkExpired({ targetType, targetId }: LinkedTarget): ShareLinkExpired {
  return {
    code: ErrorCodes.SHARE_LINK_EXPIRED,
    message: 'This share link has expired or was revoked',
    targetType,
    targetId,
  };
}

export function shareLinkLimit({ targetType, targetId }: LinkedTarget): ShareLinkLimit {
  return {
    code: ErrorCodes.SHARE_LINK_LIMIT,
    message: `A ${targetType} has at most ${MAX_ACTIVE_SHARE_LINKS} active share links`,
    targetType,
    targetId,
    limit: MAX_ACTIVE_SHARE_LINKS,
  };
}

export function invalidShareLink(reason: string): InvalidShareLink {
  return invalidField('label', reason, { maxLabelLength: SHARE_LINK_LABEL_MAX_LENGTH });
}

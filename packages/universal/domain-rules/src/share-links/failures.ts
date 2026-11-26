import { type Failure } from '@kit/errors';
import { MAX_ACTIVE_SHARE_LINKS, SHARE_LINK_LABEL_MAX_LENGTH } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

export type ShareLinkNotFound = Failure<typeof ErrorCodes.SHARE_LINK_NOT_FOUND, { linkId: string }>;
export type ShareLinkExpired = Failure<typeof ErrorCodes.SHARE_LINK_EXPIRED, { videoId: string }>;
export type ShareLinkLimit = Failure<
  typeof ErrorCodes.SHARE_LINK_LIMIT,
  { videoId: string; limit: number }
>;
export type InvalidShareLink = InvalidField<{ readonly maxLabelLength: number }>;

export function shareLinkNotFound(linkId: string): ShareLinkNotFound {
  return { code: ErrorCodes.SHARE_LINK_NOT_FOUND, message: 'Share link not found', linkId };
}

export function shareLinkExpired(videoId: string): ShareLinkExpired {
  return {
    code: ErrorCodes.SHARE_LINK_EXPIRED,
    message: 'This share link has expired or was revoked',
    videoId,
  };
}

export function shareLinkLimit(videoId: string): ShareLinkLimit {
  return {
    code: ErrorCodes.SHARE_LINK_LIMIT,
    message: `A video has at most ${MAX_ACTIVE_SHARE_LINKS} active share links`,
    videoId,
    limit: MAX_ACTIVE_SHARE_LINKS,
  };
}

export function invalidShareLink(reason: string): InvalidShareLink {
  return invalidField('label', reason, { maxLabelLength: SHARE_LINK_LABEL_MAX_LENGTH });
}

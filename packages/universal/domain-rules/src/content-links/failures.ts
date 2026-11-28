import type { Failure } from '@kit/errors';
import type { ContentLinkRelation } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';

export type ContentLinkNotFound = Failure<
  typeof ErrorCodes.CONTENT_LINK_NOT_FOUND,
  { linkId: string }
>;
export type LinkPairNotAllowed = Failure<
  typeof ErrorCodes.LINK_PAIR_NOT_ALLOWED,
  { relation: ContentLinkRelation }
>;
export type LinkRelationSameChannel = Failure<
  typeof ErrorCodes.LINK_RELATION_SAME_CHANNEL,
  { relation: ContentLinkRelation }
>;
export type LinkTargetBlocks = Failure<typeof ErrorCodes.LINK_TARGET_BLOCKS, { channelId: string }>;
export type LinkTargetNotPublic = Failure<typeof ErrorCodes.LINK_TARGET_NOT_PUBLIC>;
export type LinkSelf = Failure<typeof ErrorCodes.LINK_SELF>;
export type LinkLoop = Failure<typeof ErrorCodes.LINK_LOOP, { relation: ContentLinkRelation }>;
export type LinkLimitScope = 'item' | 'channel';
export type LinkLimit = Failure<
  typeof ErrorCodes.LINK_LIMIT,
  { scope: LinkLimitScope; limit: number }
>;
export type LinkAnchorInvalid = Failure<
  typeof ErrorCodes.LINK_ANCHOR_INVALID,
  { side: 'source' | 'target' }
>;
export type LinkExists = Failure<typeof ErrorCodes.LINK_EXISTS>;
export type LinkSuggestionLimit = Failure<
  typeof ErrorCodes.LINK_SUGGESTION_LIMIT,
  { limit: number }
>;
export type EndScreenInvalid = Failure<
  typeof ErrorCodes.END_SCREEN_INVALID,
  { reason: 'items' | 'start' | 'item_type' }
>;

export const contentLinkNotFound = (linkId: string): ContentLinkNotFound => ({
  code: ErrorCodes.CONTENT_LINK_NOT_FOUND,
  message: 'Link not found',
  linkId,
});

export const linkPairNotAllowed = (relation: ContentLinkRelation): LinkPairNotAllowed => ({
  code: ErrorCodes.LINK_PAIR_NOT_ALLOWED,
  message: `A ${relation} link cannot join these kinds`,
  relation,
});

export const linkRelationSameChannel = (
  relation: ContentLinkRelation
): LinkRelationSameChannel => ({
  code: ErrorCodes.LINK_RELATION_SAME_CHANNEL,
  message: `A ${relation} link stays inside one channel`,
  relation,
});

export const linkTargetBlocks = (channelId: string): LinkTargetBlocks => ({
  code: ErrorCodes.LINK_TARGET_BLOCKS,
  message: 'The target channel does not accept links from other channels',
  channelId,
});

export const linkTargetNotPublic = (): LinkTargetNotPublic => ({
  code: ErrorCodes.LINK_TARGET_NOT_PUBLIC,
  message: 'A link to another channel needs a public, ready target',
});

export const linkSelf = (): LinkSelf => ({
  code: ErrorCodes.LINK_SELF,
  message: 'An item cannot link to itself',
});

export const linkLoop = (relation: ContentLinkRelation): LinkLoop => ({
  code: ErrorCodes.LINK_LOOP,
  message: `This ${relation} link would close a loop`,
  relation,
});

export const linkLimit = (scope: LinkLimitScope, limit: number): LinkLimit => ({
  code: ErrorCodes.LINK_LIMIT,
  message: `The ${scope} holds its ${limit} links`,
  scope,
  limit,
});

export const linkAnchorInvalid = (side: 'source' | 'target'): LinkAnchorInvalid => ({
  code: ErrorCodes.LINK_ANCHOR_INVALID,
  message: `The ${side} anchor is not inside the content`,
  side,
});

export const linkExists = (): LinkExists => ({
  code: ErrorCodes.LINK_EXISTS,
  message: 'This link already exists',
});

export const linkSuggestionLimit = (limit: number): LinkSuggestionLimit => ({
  code: ErrorCodes.LINK_SUGGESTION_LIMIT,
  message: `A viewer suggests up to ${limit} links a day`,
  limit,
});

export const endScreenInvalid = (reason: EndScreenInvalid['reason']): EndScreenInvalid => ({
  code: ErrorCodes.END_SCREEN_INVALID,
  message: `The end screen is invalid: ${reason}`,
  reason,
});

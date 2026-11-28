import { ErrorCodes } from '@vp/errors';
import {
  contentLinkNotFound,
  endScreenInvalid,
  linkAnchorInvalid,
  linkExists,
  linkLimit,
  linkLoop,
  linkPairNotAllowed,
  linkRelationSameChannel,
  linkSelf,
  linkSuggestionLimit,
  linkTargetBlocks,
  linkTargetNotPublic,
} from '../failures';

describe('@vp/domain-rules: content link failures', () => {
  it.each([
    { failure: contentLinkNotFound('l1'), code: ErrorCodes.CONTENT_LINK_NOT_FOUND },
    { failure: linkPairNotAllowed('recap'), code: ErrorCodes.LINK_PAIR_NOT_ALLOWED },
    { failure: linkRelationSameChannel('recap'), code: ErrorCodes.LINK_RELATION_SAME_CHANNEL },
    { failure: linkTargetBlocks('c1'), code: ErrorCodes.LINK_TARGET_BLOCKS },
    { failure: linkTargetNotPublic(), code: ErrorCodes.LINK_TARGET_NOT_PUBLIC },
    { failure: linkSelf(), code: ErrorCodes.LINK_SELF },
    { failure: linkLoop('previous'), code: ErrorCodes.LINK_LOOP },
    { failure: linkLimit('item', 20), code: ErrorCodes.LINK_LIMIT },
    { failure: linkAnchorInvalid('source'), code: ErrorCodes.LINK_ANCHOR_INVALID },
    { failure: linkExists(), code: ErrorCodes.LINK_EXISTS },
    { failure: linkSuggestionLimit(10), code: ErrorCodes.LINK_SUGGESTION_LIMIT },
    { failure: endScreenInvalid('start'), code: ErrorCodes.END_SCREEN_INVALID },
  ])('$code carries its code and a message', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(failure.message).not.toBe('');
  });
});

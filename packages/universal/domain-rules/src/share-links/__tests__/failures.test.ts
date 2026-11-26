import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import { invalidShareLink, shareLinkExpired, shareLinkLimit, shareLinkNotFound } from '../failures';

describe('@vp/domain-rules: share link failures', () => {
  it.each([
    {
      failure: shareLinkNotFound('l1'),
      expected: { code: ErrorCodes.SHARE_LINK_NOT_FOUND, linkId: 'l1' },
    },
    {
      failure: shareLinkExpired('v1'),
      expected: { code: ErrorCodes.SHARE_LINK_EXPIRED, videoId: 'v1' },
    },
    {
      failure: shareLinkLimit('v1'),
      expected: { code: ErrorCodes.SHARE_LINK_LIMIT, videoId: 'v1', limit: 50 },
    },
  ])('names $expected.code', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });

  it('names the label and is wire-safe', () => {
    const failure = invalidShareLink('too long');

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'label',
      maxLabelLength: 60,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});

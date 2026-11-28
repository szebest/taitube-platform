import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import { invalidShareLink, shareLinkExpired, shareLinkLimit, shareLinkNotFound } from '../failures';

const VIDEO = { targetType: 'video', targetId: 'v1' } as const;
const PLAYLIST = { targetType: 'playlist', targetId: 'p1' } as const;

describe('@vp/domain-rules: share link failures', () => {
  it.each([
    {
      failure: shareLinkNotFound('l1'),
      expected: { code: ErrorCodes.SHARE_LINK_NOT_FOUND, linkId: 'l1' },
    },
    {
      failure: shareLinkExpired(VIDEO),
      expected: { code: ErrorCodes.SHARE_LINK_EXPIRED, ...VIDEO },
    },
    {
      failure: shareLinkLimit(PLAYLIST),
      expected: { code: ErrorCodes.SHARE_LINK_LIMIT, ...PLAYLIST, limit: 50 },
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

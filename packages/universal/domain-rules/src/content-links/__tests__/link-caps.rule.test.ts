import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decideLinkCaps } from '../link-caps.rule';

describe('@vp/domain-rules: decideLinkCaps', () => {
  it('allows the 20th outgoing link', () => {
    expect(isOk(decideLinkCaps({ outgoing: 19, channelTotal: 4999 }))).toBe(true);
  });

  it.each([
    { outgoing: 20, channelTotal: 0, scope: 'item', limit: 20 },
    { outgoing: 0, channelTotal: 5000, scope: 'channel', limit: 5000 },
  ])('refuses past the $scope cap', ({ outgoing, channelTotal, scope, limit }) => {
    const result = decideLinkCaps({ outgoing, channelTotal });
    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.LINK_LIMIT,
      scope,
      limit,
    });
  });
});

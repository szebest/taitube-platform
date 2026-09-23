import { ErrorCodes, isInputFailure } from '@vp/errors';
import { cannotSubscribeToSelf, channelForbidden, channelNotFound, handleTaken } from '../failures';

describe('@vp/domain-rules: channel failures', () => {
  it.each([
    {
      name: 'channelNotFound',
      failure: channelNotFound('@me'),
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
    { name: 'handleTaken', failure: handleTaken('me'), code: ErrorCodes.HANDLE_ALREADY_TAKEN },
    {
      name: 'cannotSubscribeToSelf',
      failure: cannotSubscribeToSelf('c1'),
      code: ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
    },
    { name: 'channelForbidden', failure: channelForbidden('c1'), code: ErrorCodes.FORBIDDEN },
  ])('$name carries $code and stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });

  it('names the handle that was taken', () => {
    expect(handleTaken('me')).toMatchObject({ handle: 'me' });
  });
});

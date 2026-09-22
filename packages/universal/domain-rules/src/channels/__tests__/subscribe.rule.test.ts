import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { OWNER, STRANGER, aChannel } from '../../__tests__/entities';
import { decideSubscribe } from '../subscribe.rule';

const channel = aChannel();

describe('@vp/domain-rules: decideSubscribe', () => {
  it('lets a signed-in stranger subscribe', () => {
    expect(isOk(decideSubscribe({ subscriber: STRANGER, channel }))).toBe(true);
  });

  it('refuses an anonymous subscriber', () => {
    const result = decideSubscribe({ subscriber: null, channel });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('refuses the channel owner subscribing to themselves', () => {
    const result = decideSubscribe({ subscriber: OWNER, channel });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF);
  });
});

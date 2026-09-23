import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { OWNER, STRANGER, aChannel } from '../../__tests__/entities';
import { decideSubscribe, decideUnsubscribe } from '../subscribe.rule';

const channel = aChannel();
const channelId = channel.id;

describe('@vp/domain-rules: decideSubscribe', () => {
  it('lets a signed-in stranger subscribe', () => {
    expect(isOk(decideSubscribe({ subscriber: STRANGER, channel, channelId }))).toBe(true);
  });

  it('refuses an anonymous subscriber', () => {
    const result = decideSubscribe({ subscriber: null, channel, channelId });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('refuses the channel owner subscribing to themselves', () => {
    const result = decideSubscribe({ subscriber: OWNER, channel, channelId });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF);
  });

  it('owns the absent-channel verdict the repositories used to keep two copies of', () => {
    const result = decideSubscribe({ subscriber: STRANGER, channel: null, channelId });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
  });

  it('does not let an anonymous caller learn whether a channel id exists', () => {
    const result = decideSubscribe({ subscriber: null, channel: null, channelId });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });
});

describe('@vp/domain-rules: decideUnsubscribe', () => {
  it('lets the owner unsubscribe from their own channel, which is a no-op not a conflict', () => {
    expect(isOk(decideUnsubscribe({ subscriber: OWNER, channel, channelId }))).toBe(true);
  });

  it.each([
    { name: 'an anonymous caller', subscriber: null, chan: channel, code: ErrorCodes.FORBIDDEN },
    {
      name: 'an absent channel',
      subscriber: STRANGER,
      chan: null,
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
  ])('refuses $name with $code', ({ subscriber, chan, code }) => {
    const result = decideUnsubscribe({ subscriber, channel: chan, channelId });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});

import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aChannel } from '../../__tests__/entities';
import { decideSubscribe, decideUnsubscribe } from '../subscribe.rule';

const channel = aChannel();
const channelId = channel.id;

describe('@vp/domain-rules: decideSubscribe', () => {
  const otherChannelId = 'channel-2';

  it.each([
    { name: 'a signed-in stranger', subscriber: STRANGER },
    { name: 'the owner acting as another of their channels', subscriber: OWNER },
  ])('lets $name subscribe', ({ subscriber }) => {
    const result = decideSubscribe({
      subscriber,
      channel,
      channelId,
      subscriberChannelId: otherChannelId,
    });

    expect(isOk(result)).toBe(true);
  });

  it.each([
    {
      name: 'an anonymous subscriber',
      subscriber: null,
      chan: channel,
      subscriberChannelId: otherChannelId,
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'a channel subscribing to itself',
      subscriber: OWNER,
      chan: channel,
      subscriberChannelId: channelId,
      code: ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
    },
    {
      name: 'an absent channel',
      subscriber: STRANGER,
      chan: null,
      subscriberChannelId: otherChannelId,
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
    {
      name: 'an anonymous caller probing an absent channel id',
      subscriber: null,
      chan: null,
      subscriberChannelId: otherChannelId,
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $name with $code', ({ subscriber, chan, subscriberChannelId, code }) => {
    const result = decideSubscribe({ subscriber, channel: chan, channelId, subscriberChannelId });

    expect(isErr(result) && result.error.code).toBe(code);
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

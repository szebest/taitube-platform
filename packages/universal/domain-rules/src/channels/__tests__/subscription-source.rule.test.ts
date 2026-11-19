import { aChannel, aVideo } from '../../__tests__/entities';
import { subscriptionSourceOf } from '../subscription-source.rule';

const channel = aChannel();

describe('@vp/domain-rules: subscriptionSourceOf', () => {
  it.each([
    ['a public video of the channel', aVideo({ id: 'v1', channelId: channel.id }), 'v1'],
    ['a video of another channel', aVideo({ channelId: 'another-channel' }), null],
    [
      "a video of the owner's other channel",
      aVideo({ ownerId: channel.userId, channelId: 'another-channel' }),
      null,
    ],
    [
      'an unlisted video of the channel',
      aVideo({ channelId: channel.id, visibility: 'unlisted' }),
      null,
    ],
    [
      'a private video of the channel',
      aVideo({ channelId: channel.id, visibility: 'private' }),
      null,
    ],
    ['no video', null, null],
  ])('credits %s: %s', (_label, video, expected) => {
    expect(subscriptionSourceOf(channel, video)).toBe(expected);
  });
});

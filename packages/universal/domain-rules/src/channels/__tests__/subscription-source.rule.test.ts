import { aChannel, aVideo } from '../../__tests__/entities';
import { subscriptionSourceOf } from '../subscription-source.rule';

const channel = aChannel();

describe('@vp/domain-rules: subscriptionSourceOf', () => {
  it.each([
    ['a public video of the channel', aVideo({ id: 'v1', ownerId: channel.userId }), 'v1'],
    ['a video of another channel', aVideo({ ownerId: 'someone-else' }), null],
    [
      'an unlisted video of the channel',
      aVideo({ ownerId: channel.userId, visibility: 'unlisted' }),
      null,
    ],
    [
      'a private video of the channel',
      aVideo({ ownerId: channel.userId, visibility: 'private' }),
      null,
    ],
    ['no video', null, null],
  ])('credits %s: %s', (_label, video, expected) => {
    expect(subscriptionSourceOf(channel, video)).toBe(expected);
  });
});

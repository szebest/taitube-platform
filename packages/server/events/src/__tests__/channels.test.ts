import {
  USER_WILDCARD_CHANNEL,
  VIDEO_WILDCARD_CHANNEL,
  channelType,
  userChannel,
  videoChannel,
} from '../channels';

const VIDEO_ID = '11111111-1111-7111-8111-111111111111';
const USER_ID = '22222222-2222-7222-8222-222222222222';

describe('@vp/events channels', () => {
  it('names a channel per video and per user, and a wildcard for each', () => {
    expect(videoChannel(VIDEO_ID)).toBe(`video:${VIDEO_ID}`);
    expect(userChannel(USER_ID)).toBe(`user:${USER_ID}`);
    expect(VIDEO_WILDCARD_CHANNEL).toBe('video:*');
    expect(USER_WILDCARD_CHANNEL).toBe('user:*');
  });

  it.each([
    [videoChannel(VIDEO_ID), 'video'],
    [userChannel(USER_ID), 'user'],
  ])('reads %s back as a %s channel', (channel, type) => {
    expect(channelType(channel)).toBe(type);
  });
});

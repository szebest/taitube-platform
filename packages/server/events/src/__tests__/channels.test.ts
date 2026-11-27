import {
  USER_WILDCARD_CHANNEL,
  WATCH_PARTY_WILDCARD_CHANNEL,
  VIDEO_WILDCARD_CHANNEL,
  channelType,
  liveChatChannel,
  liveStreamIdOfChat,
  roomIdOfWatchParty,
  userChannel,
  videoChannel,
  watchPartyChannel,
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

  it.each([
    [liveChatChannel(VIDEO_ID), VIDEO_ID],
    [videoChannel(VIDEO_ID), null],
  ])('reads the stream of chat channel %s as %s', (channel, liveStreamId) => {
    expect(liveStreamIdOfChat(channel)).toBe(liveStreamId);
  });

  it.each([
    [watchPartyChannel(VIDEO_ID), VIDEO_ID],
    [liveChatChannel(VIDEO_ID), null],
  ])('reads the room of watch party channel %s as %s', (channel, roomId) => {
    expect(roomIdOfWatchParty(channel)).toBe(roomId);
  });

  it('names the watch party wildcard from the same prefix as the channel', () => {
    expect(WATCH_PARTY_WILDCARD_CHANNEL).toBe(watchPartyChannel('*'));
  });
});

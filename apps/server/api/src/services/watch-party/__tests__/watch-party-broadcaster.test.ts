import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { watchPartyChannel } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { WatchPartyBroadcaster } from '../watch-party-broadcaster';

const ROOM = '018f0000-0000-7000-8000-00000000a001';
const FRAME: WatchPartyServerFrame = { type: 'closed', reason: 'owner' };

function setUp() {
  const cache = new InMemoryCacheClient();
  return { cache, broadcaster: new WatchPartyBroadcaster(cache) };
}

const published = (cache: InMemoryCacheClient) =>
  cache.publishedMessages.map(({ channel, message }) => ({ channel, ...JSON.parse(message) }));

describe('WatchPartyBroadcaster', () => {
  it.each([
    {
      name: 'a frame for the whole room',
      send: (b: WatchPartyBroadcaster) => b.toRoom(ROOM, FRAME),
      memberKey: null,
    },
    {
      name: 'a frame for one member',
      send: (b: WatchPartyBroadcaster) => b.toMember(ROOM, 'user:u1', FRAME),
      memberKey: 'user:u1',
    },
  ])('publishes $name on the room channel', async ({ send, memberKey }) => {
    const { cache, broadcaster } = setUp();

    expectOk(await send(broadcaster));

    expect(published(cache)).toEqual([
      { channel: watchPartyChannel(ROOM), memberKey, frame: FRAME },
    ]);
  });
});

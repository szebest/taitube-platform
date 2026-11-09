import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { watchPartyChannel } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { RoomEnvelopeSchema, WatchPartyBroadcaster } from '../watch-party-broadcaster';

const ROOM = '018f0000-0000-7000-8000-00000000a001';
const FRAME: WatchPartyServerFrame = { type: 'closed', reason: 'owner' };

function setUp() {
  const cache = new InMemoryCacheClient();
  return { cache, broadcaster: new WatchPartyBroadcaster(cache) };
}

const published = (cache: InMemoryCacheClient) =>
  cache.publishedMessages.map(({ channel, message }) => ({
    channel,
    ...RoomEnvelopeSchema.parse(JSON.parse(message)),
  }));

describe('WatchPartyBroadcaster', () => {
  it.each([
    {
      name: 'a frame for the whole room',
      send: (b: WatchPartyBroadcaster) => b.toRoom(ROOM, FRAME),
      envelope: { memberKey: null, audience: null, except: null, frame: FRAME },
    },
    {
      name: 'a frame for one member',
      send: (b: WatchPartyBroadcaster) => b.toMember(ROOM, 'user:u1', FRAME),
      envelope: { memberKey: 'user:u1', audience: null, except: null, frame: FRAME },
    },
    {
      name: 'a frame for the holders of one permission',
      send: (b: WatchPartyBroadcaster) => b.toHolders(ROOM, 'playback.control', FRAME),
      envelope: { memberKey: null, audience: 'playback.control', except: null, frame: FRAME },
    },
    {
      name: 'a superseding notice for every other socket of one member',
      send: (b: WatchPartyBroadcaster) => b.supersede(ROOM, 'user:u1', 'connection-1'),
      envelope: {
        memberKey: 'user:u1',
        audience: null,
        except: 'connection-1',
        frame: { type: 'superseded' },
      },
    },
  ])('publishes $name on the room channel', async ({ send, envelope }) => {
    const { cache, broadcaster } = setUp();

    expectOk(await send(broadcaster));

    expect(published(cache)).toEqual([{ channel: watchPartyChannel(ROOM), ...envelope }]);
  });
});

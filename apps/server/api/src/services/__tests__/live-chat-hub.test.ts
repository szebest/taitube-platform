import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import type { LiveChatBroadcast } from '@vp/api-contracts';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { LiveChatHub, publishLiveChat } from '../live-chat-hub';

const STREAM = '00000000-0000-7000-8000-00000000f101';
const OTHER = '00000000-0000-7000-8000-00000000f102';
const REMOVED: LiveChatBroadcast = { type: 'removed', id: '00000000-0000-7000-8000-0000000000a1' };

async function subscribedHub() {
  const cache = new InMemoryCacheClient();
  const hub = new LiveChatHub({
    cache,
    logger: createLogger({ format: 'json', service: 'hub-spec', level: 'silent' }),
  });
  expectOk(await hub.init());
  return { cache, hub };
}

describe('apps/server/api/services: LiveChatHub', () => {
  it('hands a broadcast to the sockets on its stream until they leave', async () => {
    const { cache, hub } = await subscribedHub();
    const heard: LiveChatBroadcast[] = [];
    const elsewhere: LiveChatBroadcast[] = [];
    const leave = hub.join(STREAM, (event) => heard.push(event));
    hub.join(OTHER, (event) => elsewhere.push(event));

    expectOk(await publishLiveChat(cache, STREAM, REMOVED));
    leave();
    expectOk(await publishLiveChat(cache, STREAM, REMOVED));

    expect([heard, elsewhere]).toEqual([[REMOVED], []]);
  });

  it('drops a message the contract does not know', async () => {
    const { cache, hub } = await subscribedHub();
    const heard: LiveChatBroadcast[] = [];
    hub.join(STREAM, (event) => heard.push(event));

    expectOk(await cache.publish(`live-chat:${STREAM}`, JSON.stringify({ type: 'ban' })));

    expect(heard).toEqual([]);
  });
});

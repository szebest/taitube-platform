import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { z } from 'zod';
import { PatternHub } from '../pattern-hub';

const PingSchema = z.object({ type: z.literal('ping'), n: z.number() });
type Ping = z.infer<typeof PingSchema>;

async function subscribedHub() {
  const cache = new InMemoryCacheClient();
  const hub = new PatternHub<Ping>({
    cache,
    logger: createLogger({ format: 'json', service: 'hub-spec', level: 'silent' }),
    pattern: 'room:*',
    keyOf: (channel) => (channel.startsWith('room:') ? channel.slice('room:'.length) : null),
    schema: PingSchema,
  });
  expectOk(await hub.init());
  const publish = (channel: string, message: unknown) =>
    cache.publish(channel, JSON.stringify(message));
  return { hub, cache, publish };
}

describe('apps/server/api/services: PatternHub', () => {
  it('hands a message to the listeners under its channel’s key until they leave', async () => {
    const { hub, publish } = await subscribedHub();
    const heard: Ping[] = [];
    const elsewhere: Ping[] = [];
    const leave = hub.join('a', (event) => heard.push(event));
    hub.join('b', (event) => elsewhere.push(event));

    expectOk(await publish('room:a', { type: 'ping', n: 1 }));
    leave();
    expectOk(await publish('room:a', { type: 'ping', n: 2 }));

    expect([heard, elsewhere]).toEqual([[{ type: 'ping', n: 1 }], []]);
  });

  it.each([
    { scenario: 'a message the schema refuses', raw: JSON.stringify({ type: 'pong' }) },
    { scenario: 'a message that is not JSON', raw: '{' },
  ])('drops $scenario', async ({ raw }) => {
    const { hub, cache } = await subscribedHub();
    const heard: Ping[] = [];
    hub.join('a', (event) => heard.push(event));

    expectOk(await cache.publish('room:a', raw));

    expect(heard).toEqual([]);
  });

  it('stops hearing anything once closed, and subscribes again on the next init', async () => {
    const { hub, publish } = await subscribedHub();
    const heard: Ping[] = [];
    hub.join('a', (event) => heard.push(event));

    await hub.close();
    expectOk(await publish('room:a', { type: 'ping', n: 1 }));
    expectOk(await hub.init());
    hub.join('a', (event) => heard.push(event));
    expectOk(await publish('room:a', { type: 'ping', n: 2 }));

    expect(heard).toEqual([{ type: 'ping', n: 2 }]);
  });
});

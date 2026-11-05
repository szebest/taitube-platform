import { expectOk } from '@vp/testing/result';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';
import { dial } from './socket-client';

const OWNER_ID = '11111111-1111-7111-8111-111111111111';
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';

describe('live companion socket', () => {
  let ctx: TestApp;
  let address: string;

  beforeEach(async () => {
    ctx = await buildTestApp();
    const channel = expectOk(
      await ctx.repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    expectOk(
      await ctx.repositories.liveStreams.ensureIdle(channel.id, {
        id: STREAM_ID,
        streamKey: 'key',
        overlayToken: 'overlay-token',
        controlToken: 'control-token',
      })
    );
    address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('greets a deck, then answers each command with an ack', async () => {
    const deck = await dial(address, '/v1/live/companion?token=control-token');
    await deck.next(1);

    deck.socket.send(JSON.stringify({ type: 'chat.mode', ref: 'k1', subscribersOnly: true }));
    const [hello, ack] = await deck.next(2);

    expect(hello).toMatchObject({ type: 'hello', stream: { id: STREAM_ID, status: 'IDLE' } });
    expect(ack).toMatchObject({
      type: 'ack',
      ref: 'k1',
      stream: { chat: { subscribersOnly: true } },
    });
    await deck.close();
  });

  it('refuses a token that opens no stream', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/live/companion?token=overlay-token',
    });

    expect(res.statusCode).toBe(404);
  });
});

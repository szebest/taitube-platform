import { expectOk } from '@vp/testing/result';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';

const OWNER_ID = '11111111-1111-7111-8111-111111111111';
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';

describe('live companion socket', () => {
  let ctx: TestApp;

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
    await ctx.app.ready();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  async function open(token: string) {
    const frames: unknown[] = [];
    let waiting: (() => void) | undefined;
    const ws = await ctx.app.injectWS(
      `/v1/live/companion?token=${token}`,
      {},
      {
        onInit: (socket) =>
          socket.on('message', (data) => {
            frames.push(JSON.parse(String(data)));
            waiting?.();
          }),
      }
    );
    const next = async (count: number) => {
      while (frames.length < count) await new Promise<void>((resolve) => (waiting = resolve));
      return frames.slice(0, count);
    };
    return { ws, next };
  }

  it('greets a deck, then answers each command with an ack', async () => {
    const deck = await open('control-token');
    await deck.next(1);

    deck.ws.send(JSON.stringify({ type: 'chat.mode', ref: 'k1', subscribersOnly: true }));
    const [hello, ack] = await deck.next(2);

    expect(hello).toMatchObject({ type: 'hello', stream: { id: STREAM_ID, status: 'IDLE' } });
    expect(ack).toMatchObject({
      type: 'ack',
      ref: 'k1',
      stream: { chat: { subscribersOnly: true } },
    });
    deck.ws.terminate();
  });

  it('refuses a token that opens no stream', async () => {
    await expect(open('overlay-token')).rejects.toThrow('Unexpected server response: 404');
  });
});

import type { LiveChatServerFrame } from '@vp/api-contracts';
import { mintToken } from '@vp/dev-token';
import { expectOk } from '@vp/testing/result';
import type { WebSocket } from 'ws';
import { type TestApp, bearer, buildTestApp } from '../../__tests__/test-app';

const OWNER_ID = '11111111-1111-7111-8111-111111111111';
const VIEWER = bearer(
  mintToken({ sub: '22222222-2222-7222-8222-222222222222', role: 'USER', ttl: '1h' })
);
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';

interface Socket {
  ws: WebSocket;
  frames: LiveChatServerFrame[];
  next(count: number): Promise<LiveChatServerFrame[]>;
}

describe('live chat socket', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await buildTestApp();
    const { channels, liveStreams, users } = ctx.repositories;
    expectOk(await users.upsert({ id: OWNER_ID, email: 'owner@example.com' }));
    const channel = expectOk(
      await channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Owner' })
    );
    expectOk(
      await liveStreams.ensureIdle(channel.id, {
        id: STREAM_ID,
        streamKey: 'key',
        overlayToken: 'o',
        controlToken: 'c',
      })
    );
    expectOk(
      await liveStreams.goLive({
        streamId: STREAM_ID,
        video: {
          id: '00000000-0000-7000-8000-00000000f201',
          ownerId: OWNER_ID,
          visibility: 'public',
          sourceKey: 'live/',
        },
        startedAt: new Date(),
        outbox: [],
      })
    );
    await ctx.app.ready();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  async function ticket(): Promise<string> {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/live/${STREAM_ID}/chat/ticket`,
      headers: VIEWER,
    });
    return res.json().ticket;
  }

  async function open(query = '', headers: { origin?: string } = {}): Promise<Socket> {
    const frames: LiveChatServerFrame[] = [];
    let waiting: (() => void) | undefined;
    const ws = await ctx.app.injectWS(
      `/v1/live/${STREAM_ID}/chat${query}`,
      { headers },
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
    return { ws, frames, next };
  }

  it('lets anyone read, and a ticketed viewer send to every socket on the stream', async () => {
    const reader = await open();
    const sender = await open(`?ticket=${await ticket()}`);
    await Promise.all([reader.next(1), sender.next(1)]);

    sender.ws.send(JSON.stringify({ type: 'send', ref: 'r1', message: 'gg' }));
    const [, line] = await reader.next(2);
    const sent = await sender.next(3);

    expect(reader.frames[0]).toMatchObject({ type: 'hello', canSend: false });
    expect(line).toMatchObject({ type: 'message', message: { message: 'gg' } });
    expect(
      sent
        .slice(1)
        .map((frame) => frame.type)
        .sort()
    ).toEqual(['ack', 'message']);
    reader.ws.terminate();
    sender.ws.terminate();
  });

  it('answers a line a reader sends with an error frame, and stays open', async () => {
    const reader = await open();
    await reader.next(1);

    reader.ws.send(JSON.stringify({ type: 'send', ref: 'r2', message: 'hi' }));
    const [, refused] = await reader.next(2);

    expect(refused).toMatchObject({
      type: 'error',
      ref: 'r2',
      problem: { status: 401, code: 'LIVE_CHAT_TICKET_INVALID' },
    });
    reader.ws.terminate();
  });

  it.each([
    { scenario: 'a spent ticket', query: '?ticket=spent', headers: {}, status: 401 },
    {
      scenario: 'a foreign origin',
      query: '',
      headers: { origin: 'https://evil.test' },
      status: 403,
    },
  ])('refuses the upgrade for $scenario with $status', async ({ query, headers, status }) => {
    await expect(open(query, headers)).rejects.toThrow(`Unexpected server response: ${status}`);
  });
});

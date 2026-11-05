import type { LiveChatServerFrame } from '@vp/api-contracts';
import { mintToken } from '@vp/dev-token';
import { expectOk } from '@vp/testing/result';
import { type TestApp, bearer, buildTestApp } from '../../__tests__/test-app';
import { dial } from './socket-client';

const OWNER_ID = '11111111-1111-7111-8111-111111111111';
const VIEWER = bearer(
  mintToken({ sub: '22222222-2222-7222-8222-222222222222', role: 'USER', ttl: '1h' })
);
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
const CHAT = `/v1/live/${STREAM_ID}/chat`;

describe('live chat socket', () => {
  let ctx: TestApp;
  let address: string;

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
    address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  async function ticket(): Promise<string> {
    const res = await ctx.app.inject({ method: 'POST', url: `${CHAT}/ticket`, headers: VIEWER });
    return res.json().ticket;
  }

  const open = (query = '') => dial<LiveChatServerFrame>(address, `${CHAT}${query}`);

  it('lets anyone read, and a ticketed viewer send to every socket on the stream', async () => {
    const reader = await open();
    const sender = await open(`?ticket=${await ticket()}`);
    await Promise.all([reader.next(1), sender.next(1)]);

    sender.socket.send(JSON.stringify({ type: 'send', ref: 'r1', message: 'gg' }));
    const [hello, line] = await reader.next(2);
    const sent = await sender.next(3);

    expect(hello).toMatchObject({ type: 'hello', canSend: false });
    expect(line).toMatchObject({ type: 'message', message: { message: 'gg' } });
    expect(
      sent
        .slice(1)
        .map((frame) => frame.type)
        .sort()
    ).toEqual(['ack', 'message']);
    await Promise.all([reader.close(), sender.close()]);
  });

  it('answers a line a reader sends with an error frame, and stays open', async () => {
    const reader = await open();
    await reader.next(1);

    reader.socket.send(JSON.stringify({ type: 'send', ref: 'r2', message: 'hi' }));
    const [, refused] = await reader.next(2);

    expect(refused).toMatchObject({
      type: 'error',
      ref: 'r2',
      problem: { status: 401, code: 'LIVE_CHAT_TICKET_INVALID' },
    });
    await reader.close();
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
    const res = await ctx.app.inject({ method: 'GET', url: `${CHAT}${query}`, headers });

    expect([res.statusCode, res.json().status]).toEqual([status, status]);
  });
});

import { mintToken } from '@vp/dev-token';
import { expectOk } from '@vp/testing/result';
import { type TestApp, bearer, buildTestApp } from '../../__tests__/test-app';

const OWNER_ID = '11111111-1111-7111-8111-111111111111';
const VIEWER = bearer(
  mintToken({ sub: '22222222-2222-7222-8222-222222222222', role: 'USER', ttl: '1h' })
);
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
const VIDEO_ID = '00000000-0000-7000-8000-00000000f201';

describe('live routes', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await buildTestApp();
    const { channels, liveStreams, liveChat, users } = ctx.repositories;
    expectOk(await users.upsert({ id: OWNER_ID, email: 'owner@example.com' }));
    const channel = expectOk(
      await channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Owner' })
    );
    expectOk(
      await liveStreams.ensureIdle(channel.id, {
        id: STREAM_ID,
        streamKey: 'key',
        overlayToken: 'overlay-token',
        controlToken: 'control-token',
      })
    );
    expectOk(
      await liveStreams.goLive({
        streamId: STREAM_ID,
        video: {
          id: VIDEO_ID,
          ownerId: OWNER_ID,
          visibility: 'public',
          sourceKey: `live/${STREAM_ID}/`,
        },
        startedAt: new Date('2026-03-01T12:00:00.000Z'),
        outbox: [],
      })
    );
    expectOk(
      await liveChat.append({
        id: '00000000-0000-7000-8000-0000000000a1',
        liveStreamId: STREAM_ID,
        userId: OWNER_ID,
        message: 'welcome',
        offsetMs: 1_200,
        createdAt: new Date('2026-03-01T12:00:01.200Z'),
      })
    );
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const get = (url: string) => ctx.app.inject({ method: 'GET', url });

  it.each([
    {
      url: '/v1/live',
      body: { items: [expect.objectContaining({ id: STREAM_ID, status: 'LIVE' })] },
    },
    {
      url: `/v1/live/${STREAM_ID}`,
      body: expect.objectContaining({ videoId: VIDEO_ID, viewers: 0 }),
    },
    {
      url: '/v1/live/overlay/overlay-token',
      body: { stream: expect.objectContaining({ id: STREAM_ID }), subscriberCount: 0 },
    },
    {
      url: `/v1/live/${STREAM_ID}/chat/replay?fromMs=1000&toMs=2000`,
      body: { items: [expect.objectContaining({ message: 'welcome', offsetMs: 1_200 })] },
    },
  ])('answers GET $url to anyone', async ({ url, body }) => {
    const res = await get(url);

    expect([res.statusCode, res.json()]).toEqual([200, body]);
  });

  it.each([
    { url: '/v1/live/00000000-0000-7000-8000-00000000f1ff', status: 404 },
    { url: '/v1/live/overlay/control-token', status: 404 },
    { url: `/v1/live/${STREAM_ID}/chat/replay?fromMs=2000&toMs=1000`, status: 400 },
  ])('refuses GET $url with $status', async ({ url, status }) => {
    expect((await get(url)).statusCode).toBe(status);
  });

  it('issues a one-time chat token to a signed-in viewer only', async () => {
    const url = `/v1/live/${STREAM_ID}/chat/ticket`;

    const issued = await ctx.app.inject({ method: 'POST', url, headers: VIEWER });
    const anonymous = await ctx.app.inject({ method: 'POST', url });

    expect([issued.statusCode, issued.json()]).toEqual([
      201,
      { ticket: expect.any(String), expiresAt: expect.any(String) },
    ]);
    expect(anonymous.statusCode).toBe(401);
  });
});

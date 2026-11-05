import { InMemoryLiveGateway } from '@vp/adapters/in-memory';
import { Adapters } from '@vp/adapters/composition';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { type TestApp, bearer, buildTestApp } from '../../__tests__/test-app';

const OWNER_ID = '11111111-1111-7111-8111-111111111111';
const STRANGER_ID = '22222222-2222-7222-8222-222222222222';
const AS = {
  owner: bearer(mintToken({ sub: OWNER_ID, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER_ID, role: 'USER', ttl: '1h' })),
  anonymous: {},
};

describe('creator live routes', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await buildTestApp();
    expectOk(
      await ctx.repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const call = (
    who: keyof typeof AS,
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object
  ) => ctx.app.inject({ method, url, headers: AS[who], ...(payload ? { payload } : {}) });

  async function liveStream(): Promise<{ id: string; streamKey: string }> {
    const opened = (await call('owner', 'POST', '/v1/me/live')).json();
    const videoId = '00000000-0000-7000-8000-00000000f201';
    expectOk(
      await ctx.repositories.liveStreams.goLive({
        streamId: opened.id,
        video: { id: videoId, ownerId: OWNER_ID, sourceKey: 'live/' },
        startedAt: new Date(),
        outbox: [],
      })
    );
    return { id: opened.id, streamKey: opened.ingest.streamKey };
  }

  it('opens the stream and reads it back with its credentials', async () => {
    const opened = await call('owner', 'POST', '/v1/me/live');
    const read = await call('owner', 'GET', '/v1/me/live');

    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toMatchObject({
      status: 'IDLE',
      ingest: {
        rtmpUrl: 'rtmp://localhost:1935/live',
        streamKey: expect.stringMatching(/^[\w-]{32}$/),
      },
    });
    expect(read.json().id).toBe(opened.json().id);
  });

  it('edits the title and the archive visibility', async () => {
    const { id } = (await call('owner', 'POST', '/v1/me/live')).json();

    const res = await call('owner', 'PATCH', `/v1/me/live/${id}`, {
      title: 'Speedrun',
      archiveVisibility: 'private',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: 'Speedrun', archiveVisibility: 'private' });
  });

  it('stops a live broadcast by dropping its publisher', async () => {
    const { id, streamKey } = await liveStream();
    const gateway = ctx.container.get(Adapters.LiveGateway);
    if (!(gateway instanceof InMemoryLiveGateway))
      throw new Error('expected the in-memory gateway');
    gateway.publish(`live/${streamKey}`);

    const res = await call('owner', 'POST', `/v1/me/live/${id}/stop`);

    expect(res.statusCode).toBe(202);
    expect(gateway.kicked).toEqual([`live/${streamKey}`]);
  });

  it.each([
    {
      scenario: 'a guest opening a stream',
      who: 'anonymous' as const,
      method: 'POST' as const,
      url: '/v1/me/live',
      status: 401,
    },
    {
      scenario: 'a caller who never opened one',
      who: 'owner' as const,
      method: 'GET' as const,
      url: '/v1/me/live',
      status: 404,
    },
  ])('refuses $scenario with $status', async ({ who, method, url, status }) => {
    expect((await call(who, method, url)).statusCode).toBe(status);
  });

  it.each([
    {
      scenario: 'stopping a stream that is not live',
      who: 'owner' as const,
      code: ErrorCodes.LIVE_STREAM_NOT_LIVE,
      status: 409,
    },
    {
      scenario: "stopping someone else's stream",
      who: 'stranger' as const,
      code: ErrorCodes.LIVE_STREAM_NOT_FOUND,
      status: 404,
    },
  ])('refuses $scenario', async ({ who, code, status }) => {
    const { id } = (await call('owner', 'POST', '/v1/me/live')).json();

    const res = await call(who, 'POST', `/v1/me/live/${id}/stop`);

    expect(res.statusCode).toBe(status);
    expect(res.json()).toMatchObject({ code });
  });
});

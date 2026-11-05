import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';

const SECRET = 'hook-secret';
const OWNER_ID = '11111111-1111-7111-8111-111111111111';
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';

describe('live ingest route', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    const config = inProcessAppConfig();
    ctx = await buildTestApp({
      config: { ...config, live: { ...config.live, hookSecret: SECRET } },
    });
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
        streamKey: 'key-1',
        overlayToken: 'o',
        controlToken: 'c',
      })
    );
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const call = (secret: string, path = 'live/key-1') =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/internal/live/auth?secret=${secret}`,
      payload: {
        user: '',
        password: '',
        ip: '172.18.0.1',
        action: 'publish',
        path,
        protocol: 'rtmp',
        id: null,
        query: '',
      },
    });

  it('admits a publisher on an idle key with no content, and takes the stream live', async () => {
    const res = await call(SECRET);

    expect(res.statusCode).toBe(204);
    expect(expectOk(await ctx.repositories.liveStreams.findById(STREAM_ID))?.status).toBe('LIVE');
  });

  it.each([
    { scenario: 'a wrong secret', secret: 'nope', path: 'live/key-1' },
    { scenario: 'an unknown key', secret: SECRET, path: 'live/nope' },
  ])('refuses $scenario with a 401 problem', async ({ secret, path }) => {
    const res = await call(secret, path);

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: ErrorCodes.LIVE_INGEST_REFUSED });
  });

  it('stays out of the OpenAPI document', async () => {
    const document = (await ctx.app.inject({ method: 'GET', url: '/openapi.json' })).json();

    expect(Object.keys(document.paths ?? {})).not.toContain('/v1/internal/live/auth');
  });
});

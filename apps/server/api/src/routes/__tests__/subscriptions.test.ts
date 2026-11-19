import { expectOk } from '@kit/testing/result';
import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-identity';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { bearer, buildTestApp } from '../../__tests__/test-app';

const CREATOR = '11111111-1111-7111-8111-111111111111';
const CHANNEL = '22222222-2222-7222-8222-222222222222';
const SUBSCRIBER = '55555555-5555-7555-8555-555555555555';
const WATCHED_VIDEO = '66666666-6666-7666-8666-666666666601';
const ABSENT_CHANNEL = '00000000-0000-7000-8000-000000000000';

describe('subscription routes', () => {
  let app: FastifyInstance;
  let subscriptions: InMemoryRepositories['subscriptions'];
  const creator = bearer(mintToken({ sub: CREATOR, role: 'CREATOR' }));
  const subscriber = bearer(mintToken({ sub: SUBSCRIBER, role: 'USER' }));

  beforeAll(async () => {
    const testApp = await buildTestApp();
    app = testApp.app;
    const { repositories } = testApp;
    subscriptions = repositories.subscriptions;
    await repositories.users.upsert({
      id: CREATOR,
      email: 'creator@example.com',
      role: 'CREATOR',
      tier: 'pro',
    });
    await repositories.users.upsert({
      id: SUBSCRIBER,
      email: 'subscriber@example.com',
      role: 'USER',
      tier: 'free',
    });
    await repositories.videos.create({
      id: WATCHED_VIDEO,
      ownerId: CREATOR,
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/watched.mp4',
    });
    await repositories.channels.create({
      id: CHANNEL,
      userId: CREATOR,
      handle: 'creator1',
      displayName: 'Creator One',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { method: 'POST' as const, url: `/v1/channels/${CHANNEL}/subscribers` },
    { method: 'DELETE' as const, url: `/v1/channels/${CHANNEL}/subscribers` },
    { method: 'GET' as const, url: `/v1/channels/${CHANNEL}/subscribers/me` },
    { method: 'GET' as const, url: '/v1/me/subscriptions' },
    { method: 'GET' as const, url: '/v1/feed/subscriptions' },
  ])('refuses an anonymous $method $url with 401', async ({ method, url }) => {
    const res = await app.inject({ method, url });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it.each([
    {
      failure: 'an absent channel',
      channel: ABSENT_CHANNEL,
      headers: subscriber,
      status: 404,
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
    {
      failure: 'a creator subscribing to their own channel',
      channel: CHANNEL,
      headers: creator,
      status: 400,
      code: ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
    },
  ])('maps $failure to $status', async ({ channel, headers, status, code }) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channel}/subscribers`,
      headers,
    });

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });

  it('subscribes, reports it on the channel and in the list, then unsubscribes', async () => {
    const subscribed = await app.inject({
      method: 'POST',
      url: `/v1/channels/${CHANNEL}/subscribers`,
      headers: subscriber,
    });
    expect(subscribed.statusCode).toBe(200);

    const status = await app.inject({
      method: 'GET',
      url: `/v1/channels/${CHANNEL}/subscribers/me`,
      headers: subscriber,
    });
    expect(status.json().subscribed).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/v1/me/subscriptions',
      headers: subscriber,
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).toContain(CHANNEL);

    const unsubscribed = await app.inject({
      method: 'DELETE',
      url: `/v1/channels/${CHANNEL}/subscribers`,
      headers: subscriber,
    });
    expect(unsubscribed.statusCode).toBe(200);
    expect(unsubscribed.json().subscribed).toBe(false);
  });

  it.each([
    { body: { fromVideoId: WATCHED_VIDEO }, status: 200, credited: 1 },
    { body: { fromVideoId: ABSENT_CHANNEL }, status: 200, credited: 0 },
    { body: { fromVideoId: 'not-a-uuid' }, status: 400, credited: 0 },
    { body: {}, status: 200, credited: 0 },
  ])('credits the watched video for $body with $status', async ({ body, status, credited }) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/channels/${CHANNEL}/subscribers`,
      headers: subscriber,
      payload: body,
    });

    expect(res.statusCode).toBe(status);
    expect(expectOk(await subscriptions.countFromVideo(WATCHED_VIDEO))).toBe(credited);

    await app.inject({
      method: 'DELETE',
      url: `/v1/channels/${CHANNEL}/subscribers`,
      headers: subscriber,
    });
  });

  describe('notification level', () => {
    const setLevel = (channel: string, headers: Record<string, string>, level: string) =>
      app.inject({
        method: 'PATCH',
        url: `/v1/channels/${channel}/subscribers/me`,
        headers,
        payload: { level },
      });

    afterEach(async () => {
      await app.inject({
        method: 'DELETE',
        url: `/v1/channels/${CHANNEL}/subscribers`,
        headers: subscriber,
      });
    });

    it('is set on a subscription and listed with it', async () => {
      await app.inject({
        method: 'POST',
        url: `/v1/channels/${CHANNEL}/subscribers`,
        headers: subscriber,
      });

      const res = await setLevel(CHANNEL, subscriber, 'highlights');

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ channelId: CHANNEL, level: 'highlights' });
      const list = await app.inject({
        method: 'GET',
        url: '/v1/me/subscriptions',
        headers: subscriber,
      });
      expect(list.json().items[0].notificationLevel).toBe('highlights');
    });

    it.each([
      { failure: 'a caller who is not subscribed', channel: CHANNEL, status: 404 },
      { failure: 'an absent channel', channel: ABSENT_CHANNEL, status: 404 },
    ])('maps $failure to $status', async ({ channel, status }) => {
      const res = await setLevel(channel, subscriber, 'none');

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });

    it('refuses an anonymous caller with 401', async () => {
      const res = await setLevel(CHANNEL, {}, 'none');

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('refuses a level that does not exist with 400', async () => {
      expect((await setLevel(CHANNEL, subscriber, 'some')).statusCode).toBe(400);
    });
  });

  it('serves the subscription feed to a signed-in caller', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed/subscriptions',
      headers: subscriber,
    });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().items)).toBe(true);
  });
});

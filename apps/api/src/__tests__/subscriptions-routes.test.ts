import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  CHANNEL_1,
  CHANNEL_2,
  SUBSCRIBER_ID,
  type SubscriptionsApp,
  buildSubscriptionsApp,
  creatorToken,
  getAs,
  subscription,
} from './subscriptions-app';

describe('channel subscription routes', () => {
  let ctx: SubscriptionsApp;

  beforeAll(async () => {
    ctx = await buildSubscriptionsApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it.each([
    { method: 'POST' as const, url: `/v1/channels/${CHANNEL_1.id}/subscribers` },
    { method: 'GET' as const, url: `/v1/channels/${CHANNEL_1.id}/subscribers/me` },
    { method: 'GET' as const, url: '/v1/me/subscriptions' },
    { method: 'DELETE' as const, url: `/v1/channels/${CHANNEL_1.id}/subscribers` },
  ])('requires authentication for $method $url', async ({ method, url }) => {
    const res = await ctx.app.inject({ method, url });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  describe('subscribe', () => {
    it('returns 404 when channel does not exist', async () => {
      const res = await subscription(ctx.app, 'POST', '00000000-0000-7000-8000-000000000000');
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });

    it('prevents self-subscription with 400 CANNOT_SUBSCRIBE_TO_SELF', async () => {
      const res = await subscription(ctx.app, 'POST', CHANNEL_1.id, creatorToken);
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe(ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF);
    });

    it('subscribes, counts the subscriber and caches the membership', async () => {
      const res = await subscription(ctx.app, 'POST', CHANNEL_1.id);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        channelId: CHANNEL_1.id,
        subscribed: true,
        subscriberCount: 1,
      });
      expect(expectOk(await ctx.subscriptionCache.isSubscribed(SUBSCRIBER_ID, CHANNEL_1.id))).toBe(
        true
      );
      expect(expectOk(await ctx.subscriptionCache.getSubscriberCount(CHANNEL_1.id))).toBe(1);
    });

    it('does not count a repeated subscribe twice', async () => {
      const res = await subscription(ctx.app, 'POST', CHANNEL_1.id);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        channelId: CHANNEL_1.id,
        subscribed: true,
        subscriberCount: 1,
      });
    });
  });

  it.each([
    { channelId: CHANNEL_1.id, subscribed: true },
    { channelId: CHANNEL_2.id, subscribed: false },
  ])('reports subscribed: $subscribed on /subscribers/me', async ({ channelId, subscribed }) => {
    const res = await getAs(ctx.app, `/v1/channels/${channelId}/subscribers/me`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ channelId, subscribed });
  });

  describe('GET /v1/me/subscriptions', () => {
    it('lists channels user is subscribed to with channel metadata', async () => {
      await subscription(ctx.app, 'POST', CHANNEL_2.id);

      const res = await getAs(ctx.app, '/v1/me/subscriptions');

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.items).toHaveLength(2);
      const handles = data.items.map((ch: { handle: string }) => ch.handle);
      expect(handles).toEqual(expect.arrayContaining([CHANNEL_1.handle, CHANNEL_2.handle]));
      expect(data.items[0].subscribedAt).toBeDefined();
    });

    it('supports keyset pagination limit and cursor', async () => {
      const page1 = await getAs(ctx.app, '/v1/me/subscriptions?limit=1');

      expect(page1.statusCode).toBe(200);
      const data1 = page1.json();
      expect(data1.items).toHaveLength(1);
      expect(data1.nextCursor).not.toBeNull();

      const page2 = await getAs(ctx.app, `/v1/me/subscriptions?limit=1&cursor=${data1.nextCursor}`);

      expect(page2.statusCode).toBe(200);
      const data2 = page2.json();
      expect(data2.items).toHaveLength(1);
      expect(data2.items[0].id).not.toBe(data1.items[0].id);
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribes, decrements the count and drops the cached membership', async () => {
      const res = await subscription(ctx.app, 'DELETE', CHANNEL_1.id);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        channelId: CHANNEL_1.id,
        subscribed: false,
        subscriberCount: 0,
      });
      expect(expectOk(await ctx.subscriptionCache.isSubscribed(SUBSCRIBER_ID, CHANNEL_1.id))).toBe(
        false
      );
    });

    it('stays at 0 when unsubscribing again', async () => {
      const res = await subscription(ctx.app, 'DELETE', CHANNEL_1.id);

      expect(res.statusCode).toBe(200);
      expect(res.json().subscriberCount).toBe(0);
    });
  });

  describe('concurrent requests from one user', () => {
    it('resolve 10 concurrent subscribes to a count of 1', async () => {
      await subscription(ctx.app, 'DELETE', CHANNEL_1.id);

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => subscription(ctx.app, 'POST', CHANNEL_1.id))
      );
      for (const res of responses) {
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ subscribed: true, subscriberCount: 1 });
      }

      const meRes = await getAs(ctx.app, `/v1/channels/${CHANNEL_1.id}/subscribers/me`);
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().subscribed).toBe(true);
    });

    it('resolve 10 concurrent unsubscribes to a count of 0', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => subscription(ctx.app, 'DELETE', CHANNEL_1.id))
      );
      for (const res of responses) {
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ subscribed: false, subscriberCount: 0 });
      }
    });
  });
});

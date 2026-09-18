import {
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryRepositories,
  InMemoryStorageClient,
  SubscriptionCacheService,
} from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('Channel Subscriptions & Subscribed Feed API (Ticket 41)', () => {
  let app: FastifyInstance;
  let repos: InMemoryRepositories;
  let cacheService: SubscriptionCacheService;

  const creatorUser = {
    id: '11111111-1111-7111-8111-111111111111',
    email: 'creator@example.com',
    role: 'CREATOR',
  };

  const channel1 = {
    id: '22222222-2222-7222-8222-222222222222',
    handle: 'creator1',
    displayName: 'Creator One',
  };

  const otherCreator = {
    id: '33333333-3333-7333-8333-333333333333',
    email: 'creator2@example.com',
    role: 'CREATOR',
  };

  const channel2 = {
    id: '44444444-4444-7444-8444-444444444444',
    handle: 'creator2',
    displayName: 'Creator Two',
  };

  const subscriberUser = {
    id: '55555555-5555-7555-8555-555555555555',
    email: 'subscriber@example.com',
    role: 'USER',
  };

  const creatorToken = mintToken({ sub: creatorUser.id, role: 'CREATOR', ttl: '1h' });
  const subscriberToken = mintToken({ sub: subscriberUser.id, role: 'USER', ttl: '1h' });

  beforeAll(async () => {
    repos = new InMemoryRepositories();
    cacheService = new SubscriptionCacheService();

    // Seed users
    await repos.users.upsert({
      id: creatorUser.id,
      email: creatorUser.email,
      role: 'CREATOR',
      tier: 'creator',
    });
    await repos.users.upsert({
      id: otherCreator.id,
      email: otherCreator.email,
      role: 'CREATOR',
      tier: 'creator',
    });
    await repos.users.upsert({
      id: subscriberUser.id,
      email: subscriberUser.email,
      role: 'USER',
      tier: 'free',
    });

    // Seed channels
    await repos.channels.create({
      id: channel1.id,
      userId: creatorUser.id,
      handle: channel1.handle,
      displayName: channel1.displayName,
    });
    await repos.channels.create({
      id: channel2.id,
      userId: otherCreator.id,
      handle: channel2.handle,
      displayName: channel2.displayName,
    });

    // Build app
    app = await buildApp({
      repositories: repos,
      storage: new InMemoryStorageClient(),
      cache: new InMemoryCacheClient(),
      dbClient: new InMemoryDatabaseClient(),
      subscriptionCache: cacheService,
      cdnBaseUrl: 'http://cdn.videopipeline.local',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/channels/:id/subscribers (Subscribe)', () => {
    it('requires authentication (returns 401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/channels/${channel1.id}/subscribers`,
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('returns 404 when channel does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/channels/00000000-0000-7000-8000-000000000000/subscribers',
        headers: { authorization: `Bearer ${subscriberToken}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });

    it('prevents self-subscription with 400 CANNOT_SUBSCRIBE_TO_SELF', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/channels/${channel1.id}/subscribers`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe(ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF);
    });

    it('subscribes successfully, updates counter, and updates Redis set', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/channels/${channel1.id}/subscribers`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.channelId).toBe(channel1.id);
      expect(data.subscribed).toBe(true);
      expect(data.subscriberCount).toBe(1);

      // Verify Redis cache set has the subscription
      const cached = await cacheService.isSubscribed(subscriberUser.id, channel1.id);
      expect(cached).toBe(true);

      // Verify Redis cache counter
      const cachedCount = await cacheService.getSubscriberCount(channel1.id);
      expect(cachedCount).toBe(1);
    });

    it('is idempotent: repeated subscribe requests do not duplicate increment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/channels/${channel1.id}/subscribers`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.channelId).toBe(channel1.id);
      expect(data.subscribed).toBe(true);
      expect(data.subscriberCount).toBe(1);
    });
  });

  describe('GET /v1/channels/:id/subscribers/me', () => {
    it('requires authentication (returns 401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/channels/${channel1.id}/subscribers/me`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns subscribed: true for subscribed channel', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/channels/${channel1.id}/subscribers/me`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        channelId: channel1.id,
        subscribed: true,
      });
    });

    it('returns subscribed: false for unsubscribed channel', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/channels/${channel2.id}/subscribers/me`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        channelId: channel2.id,
        subscribed: false,
      });
    });
  });

  describe('GET /v1/me/subscriptions', () => {
    it('requires authentication (returns 401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/me/subscriptions',
      });
      expect(res.statusCode).toBe(401);
    });

    it('lists channels user is subscribed to with channel metadata', async () => {
      // Also subscribe to channel 2
      await app.inject({
        method: 'POST',
        url: `/v1/channels/${channel2.id}/subscribers`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/me/subscriptions',
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.items).toHaveLength(2);
      const handles = data.items.map((ch: { handle: string }) => ch.handle);
      expect(handles).toContain(channel1.handle);
      expect(handles).toContain(channel2.handle);
      expect(data.items[0].subscribedAt).toBeDefined();
    });

    it('supports keyset pagination limit and cursor', async () => {
      const page1 = await app.inject({
        method: 'GET',
        url: '/v1/me/subscriptions?limit=1',
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(page1.statusCode).toBe(200);
      const data1 = page1.json();
      expect(data1.items).toHaveLength(1);
      expect(data1.nextCursor).not.toBeNull();

      const page2 = await app.inject({
        method: 'GET',
        url: `/v1/me/subscriptions?limit=1&cursor=${data1.nextCursor}`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(page2.statusCode).toBe(200);
      const data2 = page2.json();
      expect(data2.items).toHaveLength(1);
      expect(data2.items[0].id).not.toBe(data1.items[0].id);
    });
  });

  describe('GET /v1/feed/subscriptions (Subscription Video Feed)', () => {
    let publicVideo1Id: string;
    let publicVideo2Id: string;

    beforeAll(async () => {
      // Creator 1 uploads 1 public ready video, 1 private video
      const v1 = await repos.videos.create({
        id: '77777777-7777-7777-8777-777777777771',
        ownerId: creatorUser.id,
        title: 'Creator 1 Public Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/c1v1.mp4',
        posterKey: 'posters/c1v1.jpg',
        masterPlaylistKey: 'videos/c1v1/hls/master.m3u8',
      });
      publicVideo1Id = v1.id;

      await repos.videos.create({
        id: '77777777-7777-7777-8777-777777777772',
        ownerId: creatorUser.id,
        title: 'Creator 1 Private Video',
        visibility: 'private',
        status: 'READY',
        sourceKey: 'raw/c1v2.mp4',
      });

      // Creator 2 uploads 1 public ready video, 1 uploading video
      const v3 = await repos.videos.create({
        id: '77777777-7777-7777-8777-777777777773',
        ownerId: otherCreator.id,
        title: 'Creator 2 Public Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/c2v1.mp4',
      });
      publicVideo2Id = v3.id;

      await repos.videos.create({
        id: '77777777-7777-7777-8777-777777777774',
        ownerId: otherCreator.id,
        title: 'Creator 2 Processing Video',
        visibility: 'public',
        status: 'PROCESSING',
        sourceKey: 'raw/c2v2.mp4',
      });
    });

    it('requires authentication (returns 401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/feed/subscriptions',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns only READY and public videos from subscribed creators', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/feed/subscriptions',
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.total).toBe(2);
      expect(data.items).toHaveLength(2);

      const titles = data.items.map((v: { title: string }) => v.title);
      expect(titles).toContain('Creator 1 Public Video');
      expect(titles).toContain('Creator 2 Public Video');
      expect(titles).not.toContain('Creator 1 Private Video');
      expect(titles).not.toContain('Creator 2 Processing Video');

      // Verify CDN URLs
      const c1v = data.items.find((v: { id: string }) => v.id === publicVideo1Id);
      expect(c1v.posterUrl).toBe('http://cdn.videopipeline.local/posters/c1v1.jpg');
      const c2v = data.items.find((v: { id: string }) => v.id === publicVideo2Id);
      expect(c2v).toBeDefined();
      expect(c1v.playbackUrl).toBe('http://cdn.videopipeline.local/videos/c1v1/hls/master.m3u8');
    });

    it('feed cursor pagination works', async () => {
      const page1 = await app.inject({
        method: 'GET',
        url: '/v1/feed/subscriptions?limit=1',
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(page1.statusCode).toBe(200);
      const data1 = page1.json();
      expect(data1.items).toHaveLength(1);
      expect(data1.nextCursor).not.toBeNull();

      const page2 = await app.inject({
        method: 'GET',
        url: `/v1/feed/subscriptions?limit=1&cursor=${data1.nextCursor}`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(page2.statusCode).toBe(200);
      const data2 = page2.json();
      expect(data2.items).toHaveLength(1);
      expect(data2.items[0].id).not.toBe(data1.items[0].id);
    });
  });

  describe('DELETE /v1/channels/:id/subscribers (Unsubscribe)', () => {
    it('requires authentication (returns 401)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/channels/${channel1.id}/subscribers`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('unsubscribes and decrements subscriberCount and updates Redis set', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/channels/${channel1.id}/subscribers`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.channelId).toBe(channel1.id);
      expect(data.subscribed).toBe(false);
      expect(data.subscriberCount).toBe(0);

      // Verify Redis cache set is updated
      const isSub = await cacheService.isSubscribed(subscriberUser.id, channel1.id);
      expect(isSub).toBe(false);
    });

    it('is idempotent: deleting again stays at 0 and returns subscribed: false', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/channels/${channel1.id}/subscribers`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().subscriberCount).toBe(0);
    });
  });

  describe('Concurrency & Idempotency', () => {
    it('concurrent subscribe requests from same user resolve idempotently with count 1', async () => {
      // First ensure unsubscribed
      await app.inject({
        method: 'DELETE',
        url: `/v1/channels/${channel1.id}/subscribers`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });

      // Fire 10 concurrent subscribe requests
      const promises = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: `/v1/channels/${channel1.id}/subscribers`,
          headers: { authorization: `Bearer ${subscriberToken}` },
        })
      );

      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect(res.statusCode).toBe(200);
        expect(res.json().subscribed).toBe(true);
        expect(res.json().subscriberCount).toBe(1);
      }

      // Check me endpoint
      const meRes = await app.inject({
        method: 'GET',
        url: `/v1/channels/${channel1.id}/subscribers/me`,
        headers: { authorization: `Bearer ${subscriberToken}` },
      });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().subscribed).toBe(true);
    });

    it('concurrent unsubscribe requests from same user resolve idempotently with count 0', async () => {
      // Fire 10 concurrent unsubscribe requests
      const promises = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'DELETE',
          url: `/v1/channels/${channel1.id}/subscribers`,
          headers: { authorization: `Bearer ${subscriberToken}` },
        })
      );

      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect(res.statusCode).toBe(200);
        expect(res.json().subscribed).toBe(false);
        expect(res.json().subscriberCount).toBe(0);
      }
    });
  });
});


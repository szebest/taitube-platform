import {
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';

describe('Video Reactions API Routes (Ticket 40 AC 44-47)', () => {
  let app: FastifyInstance;
  let repos: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let cache: InMemoryCacheClient;

  const testUser = {
    id: '11111111-1111-7111-8111-111111111111',
    email: 'user1@example.com',
    role: 'USER',
  };

  const otherUser = {
    id: '22222222-2222-7222-8222-222222222222',
    email: 'user2@example.com',
    role: 'USER',
  };

  const guestUser = {
    id: '44444444-4444-7444-8444-444444444444',
    email: 'guest@example.com',
    role: 'GUEST',
  };

  const testVideoId = '33333333-3333-7333-8333-333333333333';
  const testUserToken = mintToken({ sub: testUser.id, role: 'USER', ttl: '1h' });
  const otherUserToken = mintToken({ sub: otherUser.id, role: 'USER', ttl: '1h' });
  const guestUserToken = mintToken({ sub: guestUser.id, role: 'GUEST', ttl: '1h' });

  beforeAll(async () => {
    repos = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    cache = new InMemoryCacheClient();

    // Seed users
    await repos.users.upsert({
      id: testUser.id,
      email: testUser.email,
      role: 'USER',
      tier: 'free',
    });
    await repos.users.upsert({
      id: otherUser.id,
      email: otherUser.email,
      role: 'USER',
      tier: 'free',
    });

    // Seed public ready video
    await repos.videos.create({
      id: testVideoId,
      ownerId: testUser.id,
      title: 'Awesome Video',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/video.mp4',
    });

    app = await buildApp({
      adapters: {
        repositories: repos,
        storage,
        cache,
        dbClient: new InMemoryDatabaseClient(),
        multipart: new InMemoryMultipartStorage(storage),
        probeQueue: new InMemoryJobQueue('probe'),
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('PUT /v1/videos/:id/reactions requires authentication (401)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      payload: { type: 'LIKE' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PUT /v1/videos/:id/reactions returns 403 when the caller role cannot react', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      headers: {
        authorization: `Bearer ${guestUserToken}`,
      },
      payload: { type: 'LIKE' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);

    const stored = await repos.videoReactions.getUserReaction(testVideoId, guestUser.id);
    expect(stored).toBeNull();
  });

  it('PUT /v1/videos/:id/reactions returns 404 for non-existent video', async () => {
    const nonExistent = '99999999-9999-7999-8999-999999999999';
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${nonExistent}/reactions`,
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
      payload: { type: 'LIKE' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PUT /v1/videos/:id/reactions records a LIKE reaction and adjusts counters (200)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
      payload: { type: 'LIKE' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.videoId).toBe(testVideoId);
    expect(body.reaction).toBe('LIKE');
    expect(body.likesCount).toBe(1);
    expect(body.dislikesCount).toBe(0);
  });

  it('GET /v1/videos/:id/reactions/me returns the caller reaction state (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${testVideoId}/reactions/me`,
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.videoId).toBe(testVideoId);
    expect(body.reaction).toBe('LIKE');
  });

  it('GET /v1/videos/:id details is enriched with likesCount and dislikesCount (AC 47)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${testVideoId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(testVideoId);
    expect(body.likesCount).toBe(1);
    expect(body.dislikesCount).toBe(0);
  });

  it('PUT /v1/videos/:id/reactions supports second user adding DISLIKE', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      headers: {
        authorization: `Bearer ${otherUserToken}`,
      },
      payload: { type: 'DISLIKE' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reaction).toBe('DISLIKE');
    expect(body.likesCount).toBe(1);
    expect(body.dislikesCount).toBe(1);
  });

  it('PUT /v1/videos/:id/reactions switches reaction from DISLIKE to LIKE', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      headers: {
        authorization: `Bearer ${otherUserToken}`,
      },
      payload: { type: 'LIKE' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reaction).toBe('LIKE');
    expect(body.likesCount).toBe(2);
    expect(body.dislikesCount).toBe(0);
  });

  it('PUT /v1/videos/:id/reactions with type NONE clears reaction', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      headers: {
        authorization: `Bearer ${otherUserToken}`,
      },
      payload: { type: 'NONE' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reaction).toBeNull();
    expect(body.likesCount).toBe(1);
    expect(body.dislikesCount).toBe(0);

    // Verify GET /me returns null
    const meRes = await app.inject({
      method: 'GET',
      url: `/v1/videos/${testVideoId}/reactions/me`,
      headers: {
        authorization: `Bearer ${otherUserToken}`,
      },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().reaction).toBeNull();
  });

  it('works via aliases /videos/:id/reactions and /videos/:id/reactions/me', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: `/videos/${testVideoId}/reactions`,
      headers: {
        authorization: `Bearer ${otherUserToken}`,
      },
      payload: { type: 'DISLIKE' },
    });
    expect(putRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/videos/${testVideoId}/reactions/me`,
      headers: {
        authorization: `Bearer ${otherUserToken}`,
      },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().reaction).toBe('DISLIKE');
  });
});

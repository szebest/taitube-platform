import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { bearer, buildTestApp, seedVideo } from './test-app';

describe('video reactions routes', () => {
  let app: FastifyInstance;
  let repos: InMemoryRepositories;

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
    ({ app, repositories: repos } = await buildTestApp());

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

    await seedVideo(repos, { id: testVideoId, ownerId: testUser.id, title: 'Awesome Video' });
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
      headers: bearer(guestUserToken),
      payload: { type: 'LIKE' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);

    const stored = expectOk(await repos.videoReactions.getUserReaction(testVideoId, guestUser.id));
    expect(stored).toBeNull();
  });

  it('PUT /v1/videos/:id/reactions returns 404 for non-existent video', async () => {
    const nonExistent = '99999999-9999-7999-8999-999999999999';
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${nonExistent}/reactions`,
      headers: bearer(testUserToken),
      payload: { type: 'LIKE' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PUT /v1/videos/:id/reactions records a LIKE reaction and adjusts counters (200)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      headers: bearer(testUserToken),
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
      headers: bearer(testUserToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.videoId).toBe(testVideoId);
    expect(body.reaction).toBe('LIKE');
  });

  it('GET /v1/videos/:id details is enriched with likesCount and dislikesCount', async () => {
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

  it.each([
    { type: 'DISLIKE', likesCount: 1, dislikesCount: 1 },
    { type: 'LIKE', likesCount: 2, dislikesCount: 0 },
  ])(
    'moves a second user to $type with likes $likesCount and dislikes $dislikesCount',
    async ({ type, likesCount, dislikesCount }) => {
      const res = await app.inject({
        method: 'PUT',
        url: `/v1/videos/${testVideoId}/reactions`,
        headers: bearer(otherUserToken),
        payload: { type },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ reaction: type, likesCount, dislikesCount });
    }
  );

  it('PUT /v1/videos/:id/reactions with type NONE clears reaction', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${testVideoId}/reactions`,
      headers: bearer(otherUserToken),
      payload: { type: 'NONE' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reaction).toBeNull();
    expect(body.likesCount).toBe(1);
    expect(body.dislikesCount).toBe(0);

    const meRes = await app.inject({
      method: 'GET',
      url: `/v1/videos/${testVideoId}/reactions/me`,
      headers: bearer(otherUserToken),
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().reaction).toBeNull();
  });

  it('works via aliases /videos/:id/reactions and /videos/:id/reactions/me', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: `/videos/${testVideoId}/reactions`,
      headers: bearer(otherUserToken),
      payload: { type: 'DISLIKE' },
    });
    expect(putRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/videos/${testVideoId}/reactions/me`,
      headers: bearer(otherUserToken),
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().reaction).toBe('DISLIKE');
  });
});

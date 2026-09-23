import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

const VIEWER = '11111111-1111-7111-8111-111111111111';
const VIDEO = '33333333-3333-7333-8333-333333333333';
const ABSENT_VIDEO = '99999999-9999-7999-8999-999999999999';

describe('reaction routes', () => {
  let app: FastifyInstance;
  const auth = { authorization: `Bearer ${mintToken({ sub: VIEWER, role: 'USER', ttl: '1h' })}` };

  beforeAll(async () => {
    const repositories = new InMemoryRepositories();
    await repositories.users.upsert({
      id: VIEWER,
      email: 'viewer@example.com',
      role: 'USER',
      tier: 'free',
    });
    await repositories.videos.create({
      id: VIDEO,
      ownerId: VIEWER,
      title: 'Reactable',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/video.mp4',
    });
    app = await buildApp({ adapters: { repositories } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { method: 'PUT' as const, url: `/v1/videos/${VIDEO}/reactions`, payload: { type: 'LIKE' } },
    { method: 'GET' as const, url: `/v1/videos/${VIDEO}/reactions/me`, payload: undefined },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('answers 400 on a reaction type outside the contract', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${VIDEO}/reactions`,
      headers: auth,
      payload: { type: 'LOVE' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('answers 404 when the video is absent', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${ABSENT_VIDEO}/reactions`,
      headers: auth,
      payload: { type: 'LIKE' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('records a reaction and reads it back for the caller', async () => {
    const set = await app.inject({
      method: 'PUT',
      url: `/v1/videos/${VIDEO}/reactions`,
      headers: auth,
      payload: { type: 'LIKE' },
    });
    const mine = await app.inject({
      method: 'GET',
      url: `/v1/videos/${VIDEO}/reactions/me`,
      headers: auth,
    });

    expect(set.statusCode).toBe(200);
    expect(set.json()).toMatchObject({ videoId: VIDEO, reaction: 'LIKE', likesCount: 1 });
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toMatchObject({ videoId: VIDEO, reaction: 'LIKE' });
  });
});

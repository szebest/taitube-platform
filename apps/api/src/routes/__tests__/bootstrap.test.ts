import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { bearer, buildTestApp } from '../../__tests__/test-app';

const USER = '00000000-0000-7000-8000-000000000049';

describe('bootstrap route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const testApp = await buildTestApp({
      config: inProcessAppConfig({ featureFlags: ['studio', 'live'] }),
    });
    app = testApp.app;
    await testApp.repositories.categories.create({ name: 'Music', slug: 'music', sortOrder: 1 });
    await testApp.repositories.categories.create({
      name: 'Hidden',
      slug: 'hidden',
      sortOrder: 0,
      isActive: false,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves a guest the active categories and the enabled flags with no user', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/bootstrap' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      user: null,
      categories: [{ slug: 'music', name: 'Music' }],
      featureFlags: { studio: true, live: true },
    });
    expect(res.json().categories).toHaveLength(1);
  });

  it('adds the caller channel when the bearer token verifies', async () => {
    const token = mintToken({ sub: USER, role: 'user', ttl: '1h' });

    const res = await app.inject({ method: 'GET', url: '/v1/bootstrap', headers: bearer(token) });

    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ userId: USER, handle: expect.any(String) });
    expect(res.json().categories).toHaveLength(1);
  });

  it('refuses a token that does not verify rather than serving it as a guest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/bootstrap',
      headers: bearer('not-a-jwt'),
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });
});

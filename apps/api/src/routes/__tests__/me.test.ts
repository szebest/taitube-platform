import { inProcessAppConfig } from '@vp/env-schema';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

const USER = '00000000-0000-7000-8000-000000000077';

describe('me routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const token = mintToken({ sub: USER, role: 'user', ttl: '1h' });
  const auth = { authorization: `Bearer ${token}` };

  beforeAll(async () => {
    repositories = new InMemoryRepositories();
    app = await buildApp({ config: inProcessAppConfig(), adapters: { repositories } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
  });

  it.each([
    { method: 'GET' as const, url: '/v1/me/account', payload: undefined },
    { method: 'PATCH' as const, url: '/v1/me/channel', payload: { displayName: 'Anyone' } },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('serves the caller account together with its channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me/account', headers: auth });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(USER);
    expect(res.json().channel.userId).toBe(USER);
  });

  it('updates the caller channel and answers with the new state', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { displayName: 'Renamed', bio: 'New bio' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId: USER, displayName: 'Renamed', bio: 'New bio' });
  });

  it('maps a handle the rule rejects to a 400 problem', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { handle: 'ab' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.INVALID_HANDLE_FORMAT);
  });
});

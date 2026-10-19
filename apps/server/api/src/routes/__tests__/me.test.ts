import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { bearer, buildTestApp } from '../../__tests__/test-app';

const USER = '00000000-0000-7000-8000-000000000077';

describe('me routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const token = mintToken({ sub: USER, role: 'user', ttl: '1h' });
  const auth = bearer(token);

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
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

  it.each([
    { claim: 'user', role: 'USER' },
    { claim: 'creator', role: 'CREATOR' },
    { claim: 'admin', role: 'ADMIN' },
    { claim: 'superuser', role: 'GUEST' },
  ])('reports the role the verified token claims, $claim as $role', async ({ claim, role }) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/account',
      headers: bearer(mintToken({ sub: USER, role: claim, ttl: '1h' })),
    });

    expect(res.json().role).toBe(role);
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

  it('saves three links, and the account then lists them', async () => {
    const links = [
      { label: 'Shop', url: 'https://shop.example.com' },
      { label: 'Blog', url: 'https://blog.example.com' },
      { label: 'Socials', url: 'https://social.example.com/me' },
    ];

    const patched = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { links },
    });
    const account = await app.inject({ method: 'GET', url: '/v1/me/account', headers: auth });

    expect(patched.statusCode).toBe(200);
    expect(patched.json().links).toEqual(links);
    expect(account.json().channel.links).toEqual(links);
  });

  it.each([
    { name: 'a non-https link', links: [{ label: 'Site', url: 'http://example.com' }] },
    {
      name: 'a sixth link',
      links: Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, url: `https://e.com/${i}` })),
    },
  ])('refuses $name as a 422 problem naming the links field', async ({ links }) => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { links },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
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

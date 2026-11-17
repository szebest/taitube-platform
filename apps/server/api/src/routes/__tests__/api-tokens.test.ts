import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { TOKENS, bearer, buildTestApp } from '../../__tests__/test-app';

const UNKNOWN_ID = '00000000-0000-7000-8000-0000000019c9';
const CREATE = {
  method: 'POST',
  url: '/v1/me/api-tokens',
  payload: { name: 'nightly', scopes: ['analytics:read'], expiry: '1y' },
} as const;

describe('api token routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const send = (token: string | null, options: InjectOptions) =>
    app.inject({ ...options, headers: token ? bearer(token) : {} });

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
  });

  it('creates with 201, lists it, and revokes it with 204, after which it is not found', async () => {
    const created = await send(TOKENS.user, CREATE);
    const { id } = created.json();

    const listed = await send(TOKENS.user, { method: 'GET', url: '/v1/me/api-tokens' });
    const revoked = await send(TOKENS.user, { method: 'DELETE', url: `/v1/me/api-tokens/${id}` });
    const again = await send(TOKENS.user, { method: 'DELETE', url: `/v1/me/api-tokens/${id}` });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'nightly', scopes: ['analytics:read'] });
    expect(listed.json().items.map((item: { id: string }) => item.id)).toEqual([id]);
    expect(revoked.statusCode).toBe(204);
    expect([again.statusCode, again.json().code]).toEqual([404, ErrorCodes.API_TOKEN_NOT_FOUND]);
  });

  it('keeps one user off the tokens of another', async () => {
    const { id } = (await send(TOKENS.user, CREATE)).json();

    const listed = await send(TOKENS.otherUser, { method: 'GET', url: '/v1/me/api-tokens' });
    const revoked = await send(TOKENS.otherUser, {
      method: 'DELETE',
      url: `/v1/me/api-tokens/${id}`,
    });

    expect(listed.json().items).toEqual([]);
    expect(revoked.statusCode).toBe(404);
  });

  it('refuses the eleventh active token with 409', async () => {
    for (let n = 0; n < 10; n += 1) await send(TOKENS.user, CREATE);

    const eleventh = await send(TOKENS.user, CREATE);

    expect([eleventh.statusCode, eleventh.json().code]).toEqual([
      409,
      ErrorCodes.API_TOKEN_LIMIT_REACHED,
    ]);
  });

  it.each<{ scenario: string; options: InjectOptions; status: number }>([
    { scenario: 'create anonymously', options: CREATE, status: 401 },
    {
      scenario: 'list anonymously',
      options: { method: 'GET', url: '/v1/me/api-tokens' },
      status: 401,
    },
    {
      scenario: 'revoke anonymously',
      options: { method: 'DELETE', url: `/v1/me/api-tokens/${UNKNOWN_ID}` },
      status: 401,
    },
    {
      scenario: 'create one that never expires',
      options: { ...CREATE, payload: { ...CREATE.payload, expiry: 'never' } },
      status: 400,
    },
  ])('refuses to $scenario with $status', async ({ options, status }) => {
    const token = status === 401 ? null : TOKENS.user;

    expect((await send(token, options)).statusCode).toBe(status);
  });
});

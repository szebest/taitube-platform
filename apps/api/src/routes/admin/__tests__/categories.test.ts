import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { ADMIN_TOKEN, TOKENS, bearer, buildTestApp } from '../../../__tests__/test-app';

const ABSENT_CATEGORY = '00000000-0000-7000-8000-000000000999';

describe('admin category routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const admin = { 'x-admin-token': ADMIN_TOKEN };

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
  });

  it.each([
    { caller: 'an anonymous caller', headers: {}, status: 401, code: ErrorCodes.UNAUTHORIZED },
    {
      caller: 'a non-admin user',
      headers: bearer(TOKENS.user),
      status: 403,
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $caller with $status', async ({ headers, status, code }) => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/categories',
      headers,
      payload: { name: 'Music', slug: 'music' },
    });

    expect(res.statusCode).toBe(status);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(code);
  });

  it('answers 400 when the slug breaks the contract', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/categories',
      headers: admin,
      payload: { name: 'Music', slug: 'Not A Slug!' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('creates with 201, updates with 200 and deletes with an empty 204', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/categories',
      headers: admin,
      payload: { name: 'Music', slug: 'music' },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();

    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/categories/${id}`,
      headers: admin,
      payload: { name: 'Live Music' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe('Live Music');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/categories/${id}`,
      headers: admin,
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe('');
  });

  it('renders a duplicate slug as a 409 naming the offending field', async () => {
    const create = () =>
      app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: admin,
        payload: { name: 'Music', slug: 'music' },
      });
    await create();

    const res = await create();

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
    expect(res.json().errors).toEqual([{ field: 'slug', slug: 'music' }]);
  });

  it.each([
    { method: 'PATCH' as const, payload: { name: 'Ghost' } },
    { method: 'DELETE' as const, payload: undefined },
  ])('answers $method on an absent category with 404', async ({ method, payload }) => {
    const res = await app.inject({
      method,
      url: `/v1/admin/categories/${ABSENT_CATEGORY}`,
      headers: admin,
      ...(payload ? { payload } : {}),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);
  });
});

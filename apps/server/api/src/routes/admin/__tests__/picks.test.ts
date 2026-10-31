import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { ADMIN_TOKEN, bearer, buildTestApp, seedVideo, TOKENS } from '../../../__tests__/test-app';

const OWNER = '00000000-0000-7000-8000-00000000c0a1';
const VIDEO = '00000000-0000-7000-8000-00000000c0b1';
const PRIVATE = '00000000-0000-7000-8000-00000000c0b2';
const ABSENT = '00000000-0000-7000-8000-00000000c0b3';
const HOUR = 3_600_000;

describe('admin pick routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const admin = { 'x-admin-token': ADMIN_TOKEN };
  const instant = (offsetHours: number) => new Date(Date.now() + offsetHours * HOUR).toISOString();

  const body = (overrides: Record<string, unknown> = {}) => ({
    videoId: VIDEO,
    startsAt: instant(1),
    endsAt: instant(25),
    note: 'Worth the ten minutes',
    ...overrides,
  });

  const created = async () =>
    (
      await app.inject({ method: 'POST', url: '/v1/admin/picks', headers: admin, payload: body() })
    ).json().id as string;

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' });
    await seedVideo(repositories, { id: VIDEO, ownerId: OWNER, title: 'Picked' });
    await seedVideo(repositories, {
      id: PRIVATE,
      ownerId: OWNER,
      title: 'Hidden',
      visibility: 'private',
    });
  });

  it.each([
    { route: 'GET /v1/admin/picks', method: 'GET', url: '/v1/admin/picks' },
    { route: 'POST /v1/admin/picks', method: 'POST', url: '/v1/admin/picks', payload: body() },
    {
      route: 'PATCH /v1/admin/picks/:id',
      method: 'PATCH',
      url: `/v1/admin/picks/${ABSENT}`,
      payload: { note: 'x' },
    },
    { route: 'DELETE /v1/admin/picks/:id', method: 'DELETE', url: `/v1/admin/picks/${ABSENT}` },
  ] as const)(
    'refuses $route to an anonymous caller with 401 and to a user with 403',
    async (route) => {
      const request = {
        method: route.method,
        url: route.url,
        payload: 'payload' in route ? route.payload : undefined,
      };

      const anonymous = await app.inject(request);
      const user = await app.inject({ ...request, headers: bearer(TOKENS.user) });

      expect([anonymous.statusCode, anonymous.json().code]).toEqual([401, ErrorCodes.UNAUTHORIZED]);
      expect([user.statusCode, user.json().code]).toEqual([403, ErrorCodes.FORBIDDEN]);
      expect(user.headers['content-type']).toContain('application/problem+json');
    }
  );

  describe('POST /v1/admin/picks', () => {
    it('schedules a pick and answers it with its video', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/picks',
        headers: admin,
        payload: body(),
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        videoId: VIDEO,
        note: 'Worth the ten minutes',
        video: { id: VIDEO, channel: { handle: 'owner' } },
      });
    });

    it.each([
      {
        scenario: 'an overlapping window',
        setup: true,
        payload: body({ startsAt: instant(2) }),
        status: 409,
        code: ErrorCodes.PICK_WINDOW_OVERLAP,
      },
      {
        scenario: 'a private video',
        setup: false,
        payload: body({ videoId: PRIVATE }),
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'an unknown video',
        setup: false,
        payload: body({ videoId: ABSENT }),
        status: 404,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        scenario: 'a window in the past',
        setup: false,
        payload: body({ startsAt: instant(-5), endsAt: instant(-2) }),
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'an over-long note',
        setup: false,
        payload: body({ note: 'a'.repeat(281) }),
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a body that is not shaped right',
        setup: false,
        payload: { videoId: 'nope' },
        status: 400,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $scenario with $status', async ({ setup, payload, status, code }) => {
      if (setup) await created();

      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/picks',
        headers: admin,
        payload,
      });

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });
  });

  describe('GET /v1/admin/picks', () => {
    it('lists the picks of the next 30 days with their videos', async () => {
      const id = await created();

      const res = await app.inject({ method: 'GET', url: '/v1/admin/picks', headers: admin });

      expect(res.statusCode).toBe(200);
      expect(res.json().items).toMatchObject([{ id, video: { id: VIDEO } }]);
    });
  });

  describe('PATCH /v1/admin/picks/:id', () => {
    it('edits the note and keeps the rest', async () => {
      const id = await created();

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/picks/${id}`,
        headers: admin,
        payload: { note: null },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id, note: null, videoId: VIDEO });
    });

    it.each([
      {
        scenario: 'an unknown pick',
        id: ABSENT,
        payload: { note: 'x' },
        status: 404,
        code: ErrorCodes.PICK_NOT_FOUND,
      },
      {
        scenario: 'a private video',
        id: undefined,
        payload: { videoId: PRIVATE },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'an empty patch',
        id: undefined,
        payload: {},
        status: 400,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $scenario with $status', async ({ id, payload, status, code }) => {
      const target = id ?? (await created());

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/picks/${target}`,
        headers: admin,
        payload,
      });

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });
  });

  describe('DELETE /v1/admin/picks/:id', () => {
    it('cancels a pick once, then reports it gone', async () => {
      const id = await created();

      const first = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/picks/${id}`,
        headers: admin,
      });
      const second = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/picks/${id}`,
        headers: admin,
      });

      expect(first.statusCode).toBe(204);
      expect([second.statusCode, second.json().code]).toEqual([404, ErrorCodes.PICK_NOT_FOUND]);
    });
  });
});

import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

const OWNER = '00000000-0000-7000-8000-000000000001';
const STRANGER = '00000000-0000-7000-8000-000000000002';
const PUBLIC_VIDEO = '018f0000-0000-7000-8000-000000000001';
const PRIVATE_VIDEO = '018f0000-0000-7000-8000-000000000002';

describe('video routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const owner = { authorization: `Bearer ${mintToken({ sub: OWNER, role: 'user', ttl: '1h' })}` };
  const stranger = {
    authorization: `Bearer ${mintToken({ sub: STRANGER, role: 'user', ttl: '1h' })}`,
  };

  beforeAll(async () => {
    repositories = new InMemoryRepositories();
    app = await buildApp({ config: inProcessAppConfig(), adapters: { repositories } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    for (const [id, visibility] of [
      [PUBLIC_VIDEO, 'public'],
      [PRIVATE_VIDEO, 'private'],
    ] as const) {
      await repositories.videos.create({
        id,
        ownerId: OWNER,
        title: `${visibility} video`,
        visibility,
        status: 'READY',
        sourceKey: `raw/${id}/source.mp4`,
      });
    }
  });

  it.each([
    { method: 'GET' as const, url: '/v1/videos' },
    { method: 'DELETE' as const, url: `/v1/videos/${PUBLIC_VIDEO}` },
    { method: 'POST' as const, url: `/v1/videos/${PUBLIC_VIDEO}/reprocess` },
  ])('refuses an anonymous $method $url with 401', async ({ method, url }) => {
    const res = await app.inject({ method, url });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('lists only the caller videos and answers 400 on a malformed cursor', async () => {
    const [mine, malformed] = await Promise.all([
      app.inject({ method: 'GET', url: '/v1/videos', headers: stranger }),
      app.inject({ method: 'GET', url: '/v1/videos?cursor=not-a-cursor!', headers: owner }),
    ]);

    expect(mine.statusCode).toBe(200);
    expect(mine.json().items).toEqual([]);
    expect(malformed.statusCode).toBe(400);
  });

  it.each([
    {
      reader: 'an anonymous caller reading a public video',
      id: PUBLIC_VIDEO,
      headers: {},
      status: 200,
    },
    {
      reader: 'a stranger reading a private video',
      id: PRIVATE_VIDEO,
      headers: stranger,
      status: 404,
    },
    { reader: 'the owner reading a private video', id: PRIVATE_VIDEO, headers: owner, status: 200 },
  ])('answers $reader with $status', async ({ id, headers, status }) => {
    const res = await app.inject({ method: 'GET', url: `/v1/videos/${id}`, headers });

    expect(res.statusCode).toBe(status);
  });

  it.each([
    { edit: 'a missing version', payload: { title: 'New' }, status: 400 },
    {
      edit: 'a stale version',
      payload: { title: 'New', version: 7 },
      status: 409,
      code: ErrorCodes.VERSION_CONFLICT,
    },
    { edit: 'the current version', payload: { title: 'New', version: 1 }, status: 200 },
  ])('answers a metadata edit carrying $edit with $status', async ({ payload, status, code }) => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${PUBLIC_VIDEO}`,
      headers: owner,
      payload,
    });

    expect(res.statusCode).toBe(status);
    if (code) expect(res.json().code).toBe(code);
  });

  it('soft-deletes with 202 for the owner and refuses a stranger with 403', async () => {
    const refused = await app.inject({
      method: 'DELETE',
      url: `/v1/videos/${PUBLIC_VIDEO}`,
      headers: stranger,
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/videos/${PUBLIC_VIDEO}`,
      headers: owner,
    });

    expect(refused.statusCode).toBe(403);
    expect(refused.json().code).toBe(ErrorCodes.FORBIDDEN);
    expect(deleted.statusCode).toBe(202);
    expect(deleted.json()).toEqual({ videoId: PUBLIC_VIDEO, status: 'DELETED' });
  });

  it('reprocesses with 202 into a new generation for the owner', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/videos/${PUBLIC_VIDEO}/reprocess`,
      headers: owner,
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ videoId: PUBLIC_VIDEO, status: 'PROBING', generation: 2 });
  });

  it.each([
    { role: 'user', sub: '00000000-0000-7000-8000-0000000000d1', limited: true },
    { role: 'admin', sub: '00000000-0000-7000-8000-0000000000d2', limited: false },
  ])(
    'limits the sixth reprocess in a minute from a $role: $limited',
    async ({ role, sub, limited }) => {
      const headers = { authorization: `Bearer ${mintToken({ sub, role, ttl: '1h' })}` };
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await app.inject({
          method: 'POST',
          url: `/v1/videos/${PUBLIC_VIDEO}/reprocess`,
          headers,
        });
        statuses.push(res.statusCode);
      }

      expect(statuses.slice(0, 5)).not.toContain(429);
      expect(statuses[5] === 429).toBe(limited);
    }
  );
});

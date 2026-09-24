import { inProcessAppConfig } from '@vp/env-schema';
import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';

describe('apps/api: route authorization', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const VIDEO_ID = '00000000-0000-7000-8000-000000000011';
  const OWNER_ID = '00000000-0000-7000-8000-000000000010';
  const OTHER_ID = '00000000-0000-7000-8000-000000000020';
  const ADMIN_ID = '00000000-0000-7000-8000-000000000030';

  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;

  async function patchTitle(title: string, token?: string) {
    const video = expectOk(await repositories.videos.findById(VIDEO_ID));
    return app.inject({
      method: 'PATCH',
      url: `/v1/videos/${VIDEO_ID}`,
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      payload: { title, version: video?.version ?? 1 },
    });
  }

  beforeAll(async () => {
    ownerToken = mintToken({ sub: OWNER_ID, role: 'user', ttl: '1h' });
    otherToken = mintToken({ sub: OTHER_ID, role: 'user', ttl: '1h' });
    adminToken = mintToken({ sub: ADMIN_ID, role: 'admin', ttl: '1h' });

    repositories = new InMemoryRepositories();
    app = (
      await composeApp({
        config: inProcessAppConfig(),
        adapters: {
          repositories,
          cache: new InMemoryCacheClient(),
          storage: new InMemoryStorageClient(),
        },
      })
    ).app;

    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER_ID,
      title: 'Owned',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/owned.mp4',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { scenario: 'anonymous', token: () => undefined, status: 401, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a non-owner', token: () => otherToken, status: 403, code: ErrorCodes.FORBIDDEN },
  ])(
    'answers $status with RFC 9457 Problem Details for $scenario',
    async ({ token, status, code }) => {
      const res = await patchTitle('Rejected edit', token());

      expect(res.statusCode).toBe(status);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.json()).toMatchObject({ code, status });
    }
  );

  it.each([
    { scenario: 'the owner', token: () => ownerToken },
    { scenario: 'an admin on a foreign resource', token: () => adminToken },
  ])('returns 200 OK for $scenario', async ({ scenario, token }) => {
    const res = await patchTitle(`Edited by ${scenario}`, token());

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe(`Edited by ${scenario}`);
  });
});

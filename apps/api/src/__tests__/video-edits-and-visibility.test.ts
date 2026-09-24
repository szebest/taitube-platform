import type { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { bearer, buildInMemoryApp, seedVideo } from './in-memory-app';
import { SEEDED } from '@vp/testing';

const USER_A = SEEDED.userId;
const USER_B = '00000000-0000-7000-8000-000000000002';
const ADMIN_USER = '00000000-0000-7000-8000-000000000099';

describe('apps/api video metadata edits and visibility', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  const tokenA = mintToken({ sub: USER_A, role: 'user', ttl: '1h' });
  const tokenB = mintToken({ sub: USER_B, role: 'user', ttl: '1h' });
  const adminToken = mintToken({ sub: ADMIN_USER, role: 'admin', ttl: '1h' });

  function patch(videoId: string, payload: Record<string, unknown>, token?: string) {
    return app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: token ? bearer(token) : {},
      payload,
    });
  }

  function get(videoId: string, token?: string) {
    return app.inject({
      method: 'GET',
      url: `/v1/videos/${videoId}`,
      headers: token ? bearer(token) : {},
    });
  }

  beforeAll(async () => {
    ({ app, repositories, cache } = await buildInMemoryApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
  });

  it.each([{ field: 'title' }, { field: 'description' }])(
    'rejects a null $field instead of reaching the NOT NULL column',
    async ({ field }) => {
      const videoId = '018f0000-0000-7000-8000-000000000041';
      await seedVideo(repositories, {
        id: videoId,
        ownerId: USER_A,
        title: 'Initial Title',
        description: 'Initial Description',
        visibility: 'private',
      });

      const res = await patch(videoId, { [field]: null, version: 1 }, tokenA);

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
    }
  );

  it('applies a PATCH at the current version and refuses a stale one with 409', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000031';
    await seedVideo(repositories, {
      id: videoId,
      ownerId: USER_A,
      title: 'Initial Title',
      description: 'Initial Description',
      visibility: 'private',
    });

    const updated = await patch(
      videoId,
      { title: 'Updated Title', description: 'Updated Description', version: 1 },
      tokenA
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      title: 'Updated Title',
      description: 'Updated Description',
      version: 2,
    });

    const events = expectOk(await repositories.events.findByVideoId(videoId));
    const metaEvent = events.find((e) => e.type === 'video.metadata_updated');
    expect(metaEvent).toBeDefined();
    expect((metaEvent?.payload as { newVersion: number }).newVersion).toBe(2);

    const conflict = await patch(videoId, { title: 'Conflicting Title', version: 1 }, tokenA);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().code).toBe(ErrorCodes.VERSION_CONFLICT);
  });

  it('moves visibility private -> unlisted -> public -> private, bumping the version each time', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000032';
    await seedVideo(repositories, {
      id: videoId,
      ownerId: USER_A,
      title: 'Visibility Test',
      visibility: 'private',
    });

    for (const [visibility, version] of [
      ['unlisted', 1],
      ['public', 2],
      ['private', 3],
    ] as const) {
      const res = await patch(videoId, { visibility, version }, tokenA);

      expect(res.statusCode).toBe(200);
      expect(res.json().visibility).toBe(visibility);
      expect(res.json().version).toBe(version + 1);
    }
  });

  it('hides a private video from strangers and lets only the owner or an admin edit it', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000033';
    await seedVideo(repositories, {
      id: videoId,
      ownerId: USER_A,
      title: 'Access Control Video',
      visibility: 'private',
    });

    const anonymous = await get(videoId);
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json().code).toBe(ErrorCodes.UNAUTHORIZED);

    const strangerGet = await get(videoId, tokenB);
    expect(strangerGet.statusCode).toBe(404);
    expect(strangerGet.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);

    expect((await patch(videoId, { title: 'Hack', version: 1 }, tokenB)).statusCode).toBe(404);

    expect((await get(videoId, adminToken)).statusCode).toBe(200);
    const adminPatch = await patch(
      videoId,
      { title: 'Admin Edit', visibility: 'unlisted', version: 1 },
      adminToken
    );
    expect(adminPatch.statusCode).toBe(200);
    expect(adminPatch.json().title).toBe('Admin Edit');

    expect((await get(videoId)).statusCode).toBe(200);

    const strangerEdit = await patch(videoId, { title: 'Unauthorized Edit', version: 2 }, tokenB);
    expect(strangerEdit.statusCode).toBe(403);
    expect(strangerEdit.json().code).toBe(ErrorCodes.FORBIDDEN);
  });
});

import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedVideo } from './test-app';

describe('apps/api: route authorization', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const VIDEO_ID = '00000000-0000-7000-8000-000000000011';

  async function patchTitle(title: string, token?: string) {
    const video = expectOk(await repositories.videos.findById(VIDEO_ID));
    return app.inject({
      method: 'PATCH',
      url: `/v1/videos/${VIDEO_ID}`,
      headers: token ? bearer(token) : {},
      payload: { title, version: video?.version ?? 1 },
    });
  }

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());

    await seedVideo(repositories, { id: VIDEO_ID, ownerId: SEEDED.userId, title: 'Owned' });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { scenario: 'anonymous', token: undefined, status: 401, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a non-owner', token: TOKENS.otherUser, status: 403, code: ErrorCodes.FORBIDDEN },
  ])(
    'answers $status with RFC 9457 Problem Details for $scenario',
    async ({ token, status, code }) => {
      const res = await patchTitle('Rejected edit', token);

      expect(res.statusCode).toBe(status);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.json()).toMatchObject({ code, status });
    }
  );

  it.each([
    { scenario: 'the owner', token: TOKENS.user },
    { scenario: 'an admin on a foreign resource', token: TOKENS.admin },
  ])('returns 200 OK for $scenario', async ({ scenario, token }) => {
    const res = await patchTitle(`Edited by ${scenario}`, token);

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe(`Edited by ${scenario}`);
  });
});

import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp } from '../../../__tests__/test-app';

const OWNER = SEEDED.userId;
const PRIVATE_VIDEO = '018f0000-0000-7000-8000-0000000000a1';
const ABSENT_VIDEO = '018f0000-0000-7000-8000-0000000000ff';

/**
 * The ADR-24 property, asserted end to end: one service call, two consumers, two answers, and no
 * branch in `VideoService` for either of them.
 */
describe('two consumers of VideoService.get render the same failure differently', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    expectOk(
      await repositories.videos.create({
        id: PRIVATE_VIDEO,
        ownerId: OWNER,
        title: 'Private',
        status: 'READY',
        visibility: 'private',
        sourceKey: `${PRIVATE_VIDEO}/source.mp4`,
      })
    );
  });

  it('the public route makes a forbidden video byte-identical to a missing one', async () => {
    const [forbidden, missing] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/v1/videos/${PRIVATE_VIDEO}`,
        headers: bearer(TOKENS.otherUser),
      }),
      app.inject({
        method: 'GET',
        url: `/v1/videos/${PRIVATE_VIDEO.replace(/a1$/, 'a2')}`,
        headers: bearer(TOKENS.otherUser),
      }),
    ]);

    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    expect({ ...forbidden.json(), instance: '' }).toEqual({ ...missing.json(), instance: '' });
  });

  it('the admin route tells an operator the truth about the same failure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/admin/videos/${PRIVATE_VIDEO}`,
      headers: bearer(TOKENS.otherUser),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
    expect(res.json().detail).toContain(PRIVATE_VIDEO);
  });

  it('both routes still agree that an absent video is absent', async () => {
    const [publicRes, adminRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/v1/videos/${ABSENT_VIDEO}`,
        headers: bearer(TOKENS.otherUser),
      }),
      app.inject({
        method: 'GET',
        url: `/v1/admin/videos/${ABSENT_VIDEO}`,
        headers: bearer(TOKENS.admin),
      }),
    ]);

    expect(publicRes.statusCode).toBe(404);
    expect(adminRes.statusCode).toBe(404);
    expect(publicRes.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    expect(adminRes.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('serves the video itself to a caller who may read it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/admin/videos/${PRIVATE_VIDEO}`,
      headers: bearer(TOKENS.admin),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(PRIVATE_VIDEO);
  });
});

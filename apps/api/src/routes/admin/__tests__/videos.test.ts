import { InMemoryCacheClient, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app';

const OWNER = '00000000-0000-7000-8000-000000000001';
const STRANGER = '00000000-0000-7000-8000-000000000002';
const OPERATOR = '00000000-0000-7000-8000-000000000099';
const PRIVATE_VIDEO = '018f0000-0000-7000-8000-0000000000a1';
const ABSENT_VIDEO = '018f0000-0000-7000-8000-0000000000ff';

/**
 * The ADR-24 property, asserted end to end: one service call, two consumers, two answers, and no
 * branch in `VideoService` for either of them.
 */
describe('two consumers of VideoService.get render the same failure differently', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let strangerToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    strangerToken = mintToken({ sub: STRANGER, role: 'user', ttl: '1h' });
    operatorToken = mintToken({ sub: OPERATOR, role: 'admin', ttl: '1h' });

    repositories = new InMemoryRepositories();
    app = await buildApp({
      adapters: {
        repositories,
        cache: new InMemoryCacheClient(),
        storage: new InMemoryStorageClient(),
      },
      cdnBaseUrl: 'http://localhost:9000/public',
    });
    await app.ready();
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
        headers: { authorization: `Bearer ${strangerToken}` },
      }),
      app.inject({
        method: 'GET',
        url: `/v1/videos/${PRIVATE_VIDEO.replace(/a1$/, 'a2')}`,
        headers: { authorization: `Bearer ${strangerToken}` },
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
      headers: { authorization: `Bearer ${strangerToken}` },
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
        headers: { authorization: `Bearer ${strangerToken}` },
      }),
      app.inject({
        method: 'GET',
        url: `/v1/admin/videos/${ABSENT_VIDEO}`,
        headers: { authorization: `Bearer ${operatorToken}` },
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
      headers: { authorization: `Bearer ${operatorToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(PRIVATE_VIDEO);
  });
});

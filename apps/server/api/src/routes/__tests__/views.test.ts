import { randomUUID } from 'node:crypto';
import { type InMemoryRepositories, InMemoryViewBuffer } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const VIDEO = '33333333-3333-7333-8333-333333333333';

describe('view routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let viewBuffer: InMemoryViewBuffer;

  const beacon = (payload: object, headers = {}) =>
    app.inject({ method: 'POST', url: `/v1/videos/${VIDEO}/views`, payload, headers });

  const telemetry = (watchSeconds = 30) => ({
    sessionId: randomUUID(),
    watchSeconds,
    videoDuration: 120,
  });

  const flushed = async () => {
    const batch = expectOk(await viewBuffer.snapshot(randomUUID()));
    if (batch) {
      expectOk(await repositories.videoViews.applyBatch(batch));
      expectOk(await viewBuffer.release(batch.batchId));
    }
    return expectOk(await repositories.videos.findById(VIDEO))?.viewsCount;
  };

  beforeAll(async () => {
    viewBuffer = new InMemoryViewBuffer();
    ({ app, repositories } = await buildTestApp({ adapters: { viewBuffer } }));
    await seedVideo(repositories, { id: VIDEO, ownerId: SEEDED.userId, title: 'Watched' });
  });

  beforeEach(async () => {
    await flushed();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts an anonymous beacon with 202', async () => {
    const res = await beacon(telemetry());

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ videoId: VIDEO });
  });

  it('accepts a beacon under the minimum watch time, and does not count it', async () => {
    const res = await beacon(telemetry(2));

    expect(res.statusCode).toBe(202);
    expect(expectOk(await viewBuffer.snapshot(randomUUID()))).toBeNull();
  });

  it('counts a signed-in viewer once, however many sessions they open', async () => {
    const before = await flushed();
    await beacon(telemetry(), bearer(TOKENS.otherUser));
    await beacon(telemetry(), bearer(TOKENS.otherUser));

    expect(await flushed()).toBe((before ?? 0) + 1);
  });

  it.each([
    ['a body without a session', { watchSeconds: 30, videoDuration: 120 }],
    ['a session that is not a UUID', { ...telemetry(), sessionId: 'abc' }],
    ['a negative watch time', { ...telemetry(), watchSeconds: -3 }],
  ])('refuses %s with 400', async (_name, payload) => {
    const res = await beacon(payload);

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('refuses a video id that is not a UUID with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/not-a-uuid/views',
      payload: telemetry(),
    });

    expect(res.statusCode).toBe(400);
  });

  it('lands 10,000 rapid beacons in the counter exactly, with no request failing', async () => {
    const before = (await flushed()) ?? 0;

    const responses = await Promise.all(Array.from({ length: 10_000 }, () => beacon(telemetry())));

    expect(responses.filter((res) => res.statusCode !== 202)).toEqual([]);
    expect(await flushed()).toBe(before + 10_000);
  });
});

import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const VIDEO_ID = '44444444-4444-7444-8444-444444444441';

describe('creator studio video routes: turning comments off', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const versionOf = async () =>
    expectOk(await repositories.videos.findById(VIDEO_ID))?.version ?? -1;

  const patch = async (payload: object) =>
    app.inject({
      method: 'PATCH',
      url: `/v1/creator/videos/${VIDEO_ID}`,
      headers: bearer(TOKENS.user),
      payload: { ...payload, version: await versionOf() },
    });

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    await seedVideo(repositories, { id: VIDEO_ID, ownerId: SEEDED.userId, title: 'Mine' });
  });

  it('turns comments off and back on, and the audit log records each toggle', async () => {
    const channel = expectOk(await repositories.channels.findByUserId(SEEDED.userId));

    const off = await patch({ commentsEnabled: false });
    const on = await patch({ commentsEnabled: true });

    expect([off.json().commentsEnabled, on.json().commentsEnabled]).toEqual([false, true]);
    const log = expectOk(
      await repositories.channelAudit.list(channel?.id ?? '', { cursor: null, limit: 10 })
    );
    expect(log.map((row) => [row.action, row.meta])).toEqual([
      ['video.comments.toggled', { enabled: true }],
      ['video.comments.toggled', { enabled: false }],
    ]);
  });

  it('records a toggle and a field edit as two rows from one request', async () => {
    const channel = expectOk(await repositories.channels.findByUserId(SEEDED.userId));

    await patch({ commentsEnabled: false, title: 'Retitled' });

    const log = expectOk(
      await repositories.channelAudit.list(channel?.id ?? '', { cursor: null, limit: 10 })
    );
    expect(log.map((row) => row.action).sort()).toEqual([
      'video.comments.toggled',
      'video.updated',
    ]);
  });

  it('leaves comments on when the edit does not mention them', async () => {
    const res = await patch({ title: 'Retitled' });

    expect(res.json().commentsEnabled).toBe(true);
  });
});

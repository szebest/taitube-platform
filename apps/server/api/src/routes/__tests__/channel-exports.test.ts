import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import type { StorageClient } from '@vp/core/ports';
import type { Channel, ChannelRole, DataExportKind } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedTeamMember } from '../../__tests__/test-app';

const UNKNOWN_ID = '00000000-0000-7000-8000-0000000018e9';

type Method = 'GET' | 'POST' | 'DELETE';

interface Call {
  method: Method;
  url: string;
  payload?: object;
}

const requestOf = (kind: DataExportKind): Call => ({
  method: 'POST',
  url: '/v1/me/channel/exports',
  payload: { kind, format: 'csv' },
});

const CALLS: Record<string, Call> = {
  'request an export': requestOf('comments'),
  'list the exports': { method: 'GET', url: '/v1/me/channel/exports' },
  'read an export': { method: 'GET', url: `/v1/me/channel/exports/${UNKNOWN_ID}` },
  'delete an export': { method: 'DELETE', url: `/v1/me/channel/exports/${UNKNOWN_ID}` },
};

describe('channel export routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let storage: StorageClient;
  let owner: Channel;

  const send = (token: string | null, { method, url, payload }: Call, channel?: string) =>
    app.inject({
      method,
      url,
      headers: {
        ...(token && bearer(token)),
        ...(channel && { [CHANNEL_HEADER]: channel }),
      },
      ...(payload && { payload }),
    });

  const join = (role: ChannelRole) =>
    seedTeamMember(repositories, { ownerId: SEEDED.userId, memberId: SEEDED.otherUserId, role });

  const finish = async (id: string) => {
    expectOk(await repositories.dataExports.start(id));
    expectOk(
      await repositories.dataExports.finish(id, {
        objectKey: `exports/${owner.id}/${id}.csv`,
        rowCount: 1,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
    );
  };

  beforeAll(async () => {
    ({ app, repositories, storage } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    const seeded = expectOk(await repositories.channels.findPrimaryByUserId(SEEDED.userId));
    if (!seeded) throw new Error('The seeded user has no channel');
    owner = seeded;
  });

  it('queues a request with 202, lists it, and records it in the audit log', async () => {
    const created = await send(TOKENS.user, requestOf('comments'));

    expect(created.statusCode).toBe(202);
    expect(created.json()).toMatchObject({
      kind: 'comments',
      format: 'csv',
      status: 'queued',
      requestedBy: SEEDED.userId,
      params: {},
    });
    expect((await send(TOKENS.user, CALLS['list the exports'] as Call)).json()).toMatchObject({
      items: [{ id: created.json().id }],
      nextCursor: null,
    });
    const audit = await send(TOKENS.user, { method: 'GET', url: '/v1/me/channel/audit' });
    expect(audit.json().items).toEqual([
      expect.objectContaining({
        action: 'export.requested',
        targetId: created.json().id,
        meta: { kind: 'comments', format: 'csv' },
      }),
    ]);
  });

  it('refuses a second export while one runs with 409, and the eleventh of a day with 429', async () => {
    const first = (await send(TOKENS.user, requestOf('videos'))).json();
    const running = await send(TOKENS.user, requestOf('comments'));
    expect([running.statusCode, running.json().code]).toEqual([409, ErrorCodes.EXPORT_IN_PROGRESS]);

    await finish(first.id);
    for (let n = 1; n < 10; n += 1)
      await finish((await send(TOKENS.user, requestOf('videos'))).json().id);
    const eleventh = await send(TOKENS.user, requestOf('videos'));

    expect([eleventh.statusCode, eleventh.json().code]).toEqual([
      429,
      ErrorCodes.EXPORT_DAILY_LIMIT,
    ]);
  });

  it('refuses a range that ends before it starts', async () => {
    const res = await send(TOKENS.user, {
      ...requestOf('channel_analytics'),
      payload: {
        kind: 'channel_analytics',
        format: 'csv',
        params: { from: '2026-02-01', to: '2026-01-01' },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('hands out a presigned GET for a ready file, and none before', async () => {
    const { id } = (await send(TOKENS.user, requestOf('videos'))).json();
    const url = `/v1/me/channel/exports/${id}`;
    expect((await send(TOKENS.user, { method: 'GET', url })).json().downloadUrl).toBeNull();

    await finish(id);
    const ready = (await send(TOKENS.user, { method: 'GET', url })).json();

    expect(ready).toMatchObject({ status: 'ready', rowCount: 1 });
    expect(ready.downloadUrl).toContain(`exports/${owner.id}/${id}.csv`);
  });

  it('deletes the file with the export, records it, and answers 404 after', async () => {
    const { id } = (await send(TOKENS.user, requestOf('videos'))).json();
    await finish(id);
    const key = `exports/${owner.id}/${id}.csv`;
    expectOk(
      await storage.uploadObject({ bucket: 'raw', key, body: 'x', contentType: 'text/csv' })
    );
    const call = { method: 'DELETE', url: `/v1/me/channel/exports/${id}` } as const;

    expect((await send(TOKENS.user, call)).statusCode).toBe(204);

    expect(expectOk(await storage.headObject('raw', key))).toBeNull();
    expect((await send(TOKENS.user, call)).json().code).toBe(ErrorCodes.EXPORT_NOT_FOUND);
    const audit = await send(TOKENS.user, { method: 'GET', url: '/v1/me/channel/audit' });
    expect(audit.json().items.map(({ action }: { action: string }) => action)).toEqual([
      'export.deleted',
      'export.requested',
    ]);
  });

  it.each<{ role: ChannelRole; kind: DataExportKind; status: number }>([
    { role: 'analytics', kind: 'channel_analytics', status: 202 },
    { role: 'analytics', kind: 'video_analytics', status: 202 },
    { role: 'analytics', kind: 'comments', status: 403 },
    { role: 'analytics', kind: 'videos', status: 403 },
    { role: 'editor', kind: 'channel_analytics', status: 403 },
    { role: 'moderator', kind: 'comments', status: 403 },
    { role: 'manager', kind: 'comments', status: 202 },
  ])('a $role requesting $kind: $status', async ({ role, kind, status }) => {
    await join(role);

    const res = await send(TOKENS.otherUser, requestOf(kind), owner.id);

    expect(res.statusCode).toBe(status);
    if (status === 403) expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('lists an analytics viewer the analytics exports only, and refuses them the others', async () => {
    const comments = (await send(TOKENS.user, requestOf('comments'))).json();
    await finish(comments.id);
    const analytics = (await send(TOKENS.user, requestOf('channel_analytics'))).json();
    await join('analytics');

    const listed = await send(TOKENS.otherUser, CALLS['list the exports'] as Call, owner.id);
    const read = await send(
      TOKENS.otherUser,
      { method: 'GET', url: `/v1/me/channel/exports/${comments.id}` },
      owner.id
    );

    expect(listed.json().items.map(({ id }: { id: string }) => id)).toEqual([analytics.id]);
    expect(read.json().code).toBe(ErrorCodes.FORBIDDEN);
  });

  it.each<ChannelRole>(['editor', 'moderator'])('refuses a %s every export route', async (role) => {
    await join(role);

    for (const [name, call] of Object.entries(CALLS)) {
      const res = await send(TOKENS.otherUser, call, owner.id);
      expect([res.statusCode, res.json().code], name).toEqual([403, ErrorCodes.FORBIDDEN]);
    }
  });

  it('refuses every export route on a channel the caller is not on', async () => {
    for (const [name, call] of Object.entries(CALLS)) {
      const res = await send(TOKENS.otherUser, call, owner.id);
      expect([res.statusCode, res.json().code], name).toEqual([
        403,
        ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
      ]);
    }
  });

  it('refuses every export route to an anonymous caller', async () => {
    for (const [name, call] of Object.entries(CALLS)) {
      const res = await send(null, call);
      expect([res.statusCode, res.json().code], name).toEqual([401, ErrorCodes.UNAUTHORIZED]);
    }
  });
});

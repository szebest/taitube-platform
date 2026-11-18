import { mintToken } from '@vp/dev-identity';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  type TestApp,
  bearer,
  buildTestApp,
  seedTeamMember,
  seedVideo,
} from '../../__tests__/test-app';

const OWNER = '11111111-1111-7111-8111-111111111111';
const EDITOR = '22222222-2222-7222-8222-222222222222';
const MODERATOR = '33333333-3333-7333-8333-333333333333';
const STRANGER = '44444444-4444-7444-8444-444444444444';
const VIDEO = '66666666-6666-7666-8666-666666666666';
const PRIVATE = '77777777-7777-7777-8777-777777777777';
const ABSENT = '99999999-9999-7999-8999-999999999999';

const AS = {
  owner: bearer(mintToken({ sub: OWNER, role: 'CREATOR', ttl: '1h' })),
  editor: bearer(mintToken({ sub: EDITOR, role: 'USER', ttl: '1h' })),
  moderator: bearer(mintToken({ sub: MODERATOR, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  anonymous: {},
};
type Who = keyof typeof AS;

const CHAPTERS = [
  { startMs: 0, title: 'Intro' },
  { startMs: 20_000, title: 'Middle' },
  { startMs: 60_000, title: 'End' },
];

describe('video tool routes', () => {
  let ctx: TestApp;

  const call = (
    who: Who,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object
  ) => ctx.app.inject({ method, url, headers: AS[who], ...(payload ? { payload } : {}) });
  const version = async (id = VIDEO) =>
    expectOk(await ctx.repositories.videos.findById(id))?.version ?? -1;
  const putChapters = async (who: Who, body: object = {}) =>
    call(who, 'PUT', `/v1/videos/${VIDEO}/chapters`, {
      chapters: CHAPTERS,
      version: await version(),
      ...body,
    });

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    ctx.repositories.clear();
    ctx.cache.clear();
    await seedVideo(ctx.repositories, {
      id: VIDEO,
      ownerId: OWNER,
      title: 'Match',
      durationMs: 120_000,
    });
    await seedVideo(ctx.repositories, {
      id: PRIVATE,
      ownerId: OWNER,
      title: 'Closed',
      visibility: 'private',
    });
    await seedTeamMember(ctx.repositories, { ownerId: OWNER, memberId: EDITOR, role: 'editor' });
    await seedTeamMember(ctx.repositories, {
      ownerId: OWNER,
      memberId: MODERATOR,
      role: 'moderator',
    });
  });

  describe('chapters', () => {
    it('replaces the set and serves it on the video resource', async () => {
      const res = await putChapters('owner', { chapters: [...CHAPTERS].reverse() });

      expect(res.statusCode).toBe(200);
      expect(res.json().chapters).toEqual(CHAPTERS);
      expect((await call('anonymous', 'GET', `/v1/videos/${VIDEO}`)).json().chapters).toEqual(
        CHAPTERS
      );
    });

    it.each([
      {
        scenario: 'a stale version',
        body: { version: 0 },
        status: 409,
        code: ErrorCodes.VERSION_CONFLICT,
      },
      {
        scenario: 'two chapters',
        body: { chapters: CHAPTERS.slice(0, 2) },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $scenario', async ({ body, status, code }) => {
      const res = await putChapters('owner', body);

      expect([res.statusCode, res.json().code]).toEqual([status, code]);
    });

    it.each([
      { who: 'editor' as const, status: 200 },
      { who: 'moderator' as const, status: 403 },
      { who: 'stranger' as const, status: 403 },
      { who: 'anonymous' as const, status: 401 },
    ])('answers $status to $who', async ({ who, status }) => {
      expect((await putChapters(who)).statusCode).toBe(status);
    });

    it('answers a private video of someone else as absent', async () => {
      const res = await call('stranger', 'PUT', `/v1/videos/${PRIVATE}/chapters`, {
        chapters: CHAPTERS,
        version: 1,
      });

      expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });
  });

  describe('revisions', () => {
    const revisions = async (who: Who = 'owner') =>
      (await call(who, 'GET', `/v1/creator/videos/${VIDEO}/revisions`)).json();

    it('lists the history and restores a revision under the current version', async () => {
      await call('owner', 'PUT', `/v1/videos/${VIDEO}/chapters`, {
        chapters: CHAPTERS,
        version: 1,
      });
      const { items } = await revisions();
      const first = items.at(-1);

      const res = await call(
        'owner',
        'POST',
        `/v1/creator/videos/${VIDEO}/revisions/${first.id}/restore`,
        { version: await version() }
      );

      expect(items.map((item: { version: number }) => item.version)).toEqual([2, 1]);
      expect(res.statusCode).toBe(200);
      expect(res.json().chapters).toEqual([]);
    });

    it('answers an unknown revision with a 404', async () => {
      const res = await call(
        'owner',
        'POST',
        `/v1/creator/videos/${VIDEO}/revisions/${ABSENT}/restore`,
        {
          version: await version(),
        }
      );

      expect(res.json().code).toBe(ErrorCodes.REVISION_NOT_FOUND);
    });

    it('answers a restore made against a stale version with a 409', async () => {
      await putChapters('owner');
      const first = (await revisions()).items.at(-1);

      const res = await call(
        'owner',
        'POST',
        `/v1/creator/videos/${VIDEO}/revisions/${first.id}/restore`,
        {
          version: 1,
        }
      );

      expect(res.json().code).toBe(ErrorCodes.VERSION_CONFLICT);
    });

    it.each([
      { who: 'editor' as const, status: 200 },
      { who: 'moderator' as const, status: 403 },
      { who: 'stranger' as const, status: 403 },
      { who: 'anonymous' as const, status: 401 },
    ])('answers $status to $who on the history', async ({ who, status }) => {
      const res = await call(who, 'GET', `/v1/creator/videos/${VIDEO}/revisions`);

      expect(res.statusCode).toBe(status);
    });
  });

  describe('chapter suggestions', () => {
    it.each([
      { who: 'owner' as const, status: 200 },
      { who: 'editor' as const, status: 200 },
      { who: 'moderator' as const, status: 403 },
    ])('answers $status to $who, saving nothing', async ({ who, status }) => {
      const res = await call(who, 'GET', `/v1/creator/videos/${VIDEO}/chapter-suggestions`);

      expect(res.statusCode).toBe(status);
      if (status === 200) expect(res.json()).toEqual({ items: [] });
      expect(await version()).toBe(1);
    });
  });

  describe('bulk', () => {
    const bulk = (who: Who, ids: string[]) =>
      call(who, 'POST', '/v1/creator/videos/bulk', { ids, patch: { commentsEnabled: false } });

    it('reports each id, a refusal beside a success, and answers 200', async () => {
      const res = await bulk('owner', [VIDEO, ABSENT]);

      expect(res.statusCode).toBe(200);
      expect(res.json().items).toEqual([
        { id: VIDEO, ok: true },
        { id: ABSENT, ok: false, code: ErrorCodes.VIDEO_NOT_FOUND },
      ]);
    });

    it.each([
      { who: 'editor' as const, ok: true },
      { who: 'moderator' as const, ok: false },
      { who: 'stranger' as const, ok: false },
    ])('reports ok=$ok for $who', async ({ who, ok }) => {
      const res = await bulk(who, [VIDEO]);

      expect(res.statusCode).toBe(200);
      expect(res.json().items[0].ok).toBe(ok);
    });

    it('refuses an empty batch and a guest', async () => {
      expect((await bulk('owner', [])).statusCode).toBe(400);
      expect((await bulk('anonymous', [VIDEO])).statusCode).toBe(401);
    });
  });

  describe('corrections', () => {
    const card = { startMs: 10_000, endMs: 15_000, text: 'The price is 5 dollars' };
    const add = (who: Who, body: object = card, id = VIDEO) =>
      call(who, 'POST', `/v1/videos/${id}/corrections`, body);

    it('adds a card, lists it to a guest and removes it', async () => {
      const created = await add('owner');
      const listed = await call('anonymous', 'GET', `/v1/videos/${VIDEO}/corrections`);
      const removed = await call(
        'owner',
        'DELETE',
        `/v1/videos/${VIDEO}/corrections/${created.json().id}`
      );

      expect(created.statusCode).toBe(201);
      expect(listed.json().items).toMatchObject([card]);
      expect(removed.statusCode).toBe(204);
    });

    it('changes a card and answers the card as it now stands', async () => {
      const created = await add('owner');

      const changed = await call(
        'editor',
        'PATCH',
        `/v1/videos/${VIDEO}/corrections/${created.json().id}`,
        { text: 'Fixed' }
      );

      expect(changed.statusCode).toBe(200);
      expect(changed.json()).toMatchObject({ ...card, text: 'Fixed' });
    });

    it.each([
      { who: 'moderator' as const, status: 403 },
      { who: 'anonymous' as const, status: 401 },
    ])('answers $status to $who changing one', async ({ who, status }) => {
      const res = await call(who, 'PATCH', `/v1/videos/${VIDEO}/corrections/${VIDEO}`, {
        text: 'Fixed',
      });

      expect(res.statusCode).toBe(status);
    });

    it.each([
      { who: 'editor' as const, status: 201 },
      { who: 'moderator' as const, status: 403 },
      { who: 'stranger' as const, status: 403 },
      { who: 'anonymous' as const, status: 401 },
    ])('answers $status to $who adding one', async ({ who, status }) => {
      expect((await add(who)).statusCode).toBe(status);
    });

    it('keeps the cards of a private video as absent as the video', async () => {
      const res = await call('stranger', 'GET', `/v1/videos/${PRIVATE}/corrections`);

      expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });

    it('refuses a bad range with a 422 and the eleventh card with a 409', async () => {
      for (let n = 0; n < 10; n++) {
        await add('owner', { startMs: n * 10_000, endMs: n * 10_000 + 5_000, text: `Fix ${n}` });
      }

      expect((await add('owner', { ...card, endMs: 11_000 })).statusCode).toBe(422);
      expect((await add('owner')).json().code).toBe(ErrorCodes.CORRECTION_LIMIT);
    });
  });
});

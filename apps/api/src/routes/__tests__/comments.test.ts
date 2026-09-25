import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { type TestApp, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const CREATOR = '11111111-1111-7111-8111-111111111111';
const AUTHOR = '22222222-2222-7222-8222-222222222222';
const STRANGER = '33333333-3333-7333-8333-333333333333';
const MODERATOR = '44444444-4444-7444-8444-444444444444';
const ADMIN = '55555555-5555-7555-8555-555555555555';
const VIDEO = '66666666-6666-7666-8666-666666666666';
const PRIVATE_VIDEO = '77777777-7777-7777-8777-777777777777';
const ABSENT = '99999999-9999-7999-8999-999999999999';

const AS = {
  creator: bearer(mintToken({ sub: CREATOR, role: 'CREATOR', ttl: '1h' })),
  author: bearer(mintToken({ sub: AUTHOR, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  moderator: bearer(mintToken({ sub: MODERATOR, role: 'MODERATOR', ttl: '1h' })),
  admin: bearer(mintToken({ sub: ADMIN, role: 'ADMIN', ttl: '1h' })),
};

type Who = keyof typeof AS;

describe('comment routes', () => {
  let ctx: TestApp;
  let app: FastifyInstance;

  beforeEach(async () => {
    ctx = await buildTestApp();
    app = ctx.app;
    const { users, channels } = ctx.repositories;
    for (const [id, role] of [
      [CREATOR, 'CREATOR'],
      [AUTHOR, 'USER'],
      [STRANGER, 'USER'],
      [MODERATOR, 'MODERATOR'],
      [ADMIN, 'ADMIN'],
    ] as const) {
      await users.upsert({ id, email: `${id.slice(0, 4)}@example.com`, role, tier: 'free' });
    }
    await channels.create({ userId: AUTHOR, handle: 'author', displayName: 'The Author' });
    await seedVideo(ctx.repositories, { id: VIDEO, ownerId: CREATOR, title: 'Open' });
    await seedVideo(ctx.repositories, {
      id: PRIVATE_VIDEO,
      ownerId: CREATOR,
      title: 'Closed',
      visibility: 'private',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  async function post(who: Who, payload: { content: string; parentId?: string }, video = VIDEO) {
    return app.inject({
      method: 'POST',
      url: `/v1/videos/${video}/comments`,
      headers: AS[who],
      payload,
    });
  }

  async function comment(who: Who, content: string, parentId?: string): Promise<string> {
    const res = await post(who, { content, ...(parentId ? { parentId } : {}) });
    expect(res.statusCode).toBe(201);
    return res.json().id;
  }

  function list(query = '', headers: Record<string, string> = {}, video = VIDEO) {
    return app.inject({ method: 'GET', url: `/v1/videos/${video}/comments${query}`, headers });
  }

  it.each([
    { method: 'POST' as const, url: `/v1/videos/${VIDEO}/comments` },
    { method: 'PATCH' as const, url: `/v1/comments/${ABSENT}` },
    { method: 'DELETE' as const, url: `/v1/comments/${ABSENT}` },
    { method: 'POST' as const, url: `/v1/comments/${ABSENT}/pin` },
    { method: 'DELETE' as const, url: `/v1/comments/${ABSENT}/pin` },
  ])('refuses an anonymous $method $url with 401', async ({ method, url }) => {
    const res = await app.inject({ method, url, payload: { content: 'x' } });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('creates a comment with its author channel and counts it', async () => {
    const res = await post('author', { content: '  first!  ' });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      videoId: VIDEO,
      parentId: null,
      content: 'first!',
      isPinned: false,
      replyCount: 0,
      author: { userId: AUTHOR, handle: 'author', isCreator: false },
    });
    expect((await list()).json().total).toBe(1);
  });

  it('badges the video owner as the creator', async () => {
    expect((await post('creator', { content: 'thanks all' })).json().author.isCreator).toBe(true);
  });

  it('threads replies one level deep, a reply to a reply joining the root', async () => {
    const root = await comment('author', 'root');
    const reply = await comment('stranger', 'reply', root);
    const nested = await post('creator', { content: 'nested', parentId: reply });

    expect(nested.json().parentId).toBe(root);

    const replies = await app.inject({ method: 'GET', url: `/v1/comments/${root}/replies` });
    expect(replies.json().items.map((item: { id: string }) => item.id)).toEqual([
      reply,
      nested.json().id,
    ]);
    const [thread] = (await list()).json().items;
    expect(thread).toMatchObject({ id: root, replyCount: 2 });
    expect((await list()).json().total).toBe(3);
  });

  it.each([
    { scenario: 'blank content', payload: { content: '   ' }, status: 422 },
    {
      scenario: 'content over 2000 characters',
      payload: { content: 'a'.repeat(2001) },
      status: 422,
    },
    { scenario: 'a malformed parent id', payload: { content: 'x', parentId: 'nope' }, status: 400 },
  ])('refuses $scenario with $status', async ({ payload, status }) => {
    const res = await post('author', payload);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it.each([
    { scenario: 'a missing video', video: ABSENT, parentId: undefined, code: 'VIDEO_NOT_FOUND' },
    {
      scenario: 'a private video, disguised as missing',
      video: PRIVATE_VIDEO,
      parentId: undefined,
      code: 'VIDEO_NOT_FOUND',
    },
    { scenario: 'a missing parent', video: VIDEO, parentId: ABSENT, code: 'COMMENT_NOT_FOUND' },
  ])('answers 404 when commenting on $scenario', async ({ video, parentId, code }) => {
    const res = await post('stranger', { content: 'hi', ...(parentId ? { parentId } : {}) }, video);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(code);
  });

  describe('listing', () => {
    it('ranks the pinned comment first, then walks the rest by keyset cursor', async () => {
      const first = await comment('author', 'one');
      const second = await comment('stranger', 'two');
      const third = await comment('author', 'three');
      await app.inject({ method: 'POST', url: `/v1/comments/${first}/pin`, headers: AS.creator });

      const page1 = (await list('?sort=newest&limit=2')).json();
      const page2 = (await list(`?sort=newest&limit=2&cursor=${page1.nextCursor}`)).json();

      expect(page1.items.map((item: { id: string }) => item.id)).toEqual([first, third]);
      expect(page2.items.map((item: { id: string }) => item.id)).toEqual([second]);
      expect(page2.nextCursor).toBeNull();
      expect(page1.total).toBe(3);
    });

    it('serves the legacy page and size query', async () => {
      await comment('author', 'one');
      const second = await comment('author', 'two');
      await comment('author', 'three');

      const res = await list('?sort=newest&page=2&size=1');

      expect(res.json().items.map((item: { id: string }) => item.id)).toEqual([second]);
    });

    it('caches the first top page and purges it on the next write', async () => {
      await comment('author', 'one');
      const key = CacheKeys.videoHotComments(VIDEO);

      await list();
      expect(expectOk(await ctx.cache.get(key))).not.toBeNull();

      await comment('stranger', 'two');
      expect(expectOk(await ctx.cache.get(key))).toBeNull();
      expect((await list()).json().items).toHaveLength(2);
    });

    it.each([
      { scenario: 'an anonymous viewer', headers: {}, status: 401, code: 'UNAUTHORIZED' },
      { scenario: 'a stranger', headers: AS.stranger, status: 404, code: 'VIDEO_NOT_FOUND' },
    ])(
      'hides the comments of a private video from $scenario',
      async ({ headers, status, code }) => {
        const res = await list('', headers, PRIVATE_VIDEO);

        expect(res.statusCode).toBe(status);
        expect(res.json().code).toBe(code);
      }
    );

    it('answers 400 on a cursor it did not mint', async () => {
      expect((await list('?cursor=not-a-cursor')).statusCode).toBe(400);
    });

    it('answers 404 for the replies of a missing comment', async () => {
      const res = await app.inject({ method: 'GET', url: `/v1/comments/${ABSENT}/replies` });

      expect(res.json().code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
    });
  });

  describe('moderation', () => {
    let id: string;

    beforeEach(async () => {
      id = await comment('author', 'original');
    });

    it.each<{ who: Who; status: number }>([
      { who: 'author', status: 200 },
      { who: 'creator', status: 403 },
      { who: 'moderator', status: 403 },
      { who: 'stranger', status: 403 },
    ])('lets only the author edit: $who gets $status', async ({ who, status }) => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/comments/${id}`,
        headers: AS[who],
        payload: { content: 'rewritten' },
      });

      expect(res.statusCode).toBe(status);
      if (status === 200)
        expect(res.json()).toMatchObject({ content: 'rewritten', isEdited: true });
    });

    it.each<{ who: Who; status: number }>([
      { who: 'author', status: 204 },
      { who: 'creator', status: 204 },
      { who: 'moderator', status: 204 },
      { who: 'admin', status: 204 },
      { who: 'stranger', status: 403 },
    ])('deletes for $who with $status', async ({ who, status }) => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/comments/${id}`,
        headers: AS[who],
      });

      expect(res.statusCode).toBe(status);
      expect((await list()).json().total).toBe(status === 204 ? 0 : 1);
    });

    it('takes a deleted root and its replies off the count', async () => {
      await comment('stranger', 'reply', id);

      await app.inject({ method: 'DELETE', url: `/v1/comments/${id}`, headers: AS.creator });

      expect((await list()).json()).toMatchObject({ items: [], total: 0 });
      const gone = await app.inject({
        method: 'PATCH',
        url: `/v1/comments/${id}`,
        headers: AS.author,
        payload: { content: 'x' },
      });
      expect(gone.json().code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
    });

    it.each<{ who: Who; status: number }>([
      { who: 'creator', status: 200 },
      { who: 'admin', status: 200 },
      { who: 'author', status: 403 },
      { who: 'moderator', status: 403 },
    ])('lets the video owner pin: $who gets $status', async ({ who, status }) => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/comments/${id}/pin`,
        headers: AS[who],
      });

      expect(res.statusCode).toBe(status);
    });

    it('moves the pin to the newly pinned comment and unpins on DELETE', async () => {
      const other = await comment('stranger', 'better');
      const pin = (target: string, method: 'POST' | 'DELETE' = 'POST') =>
        app.inject({ method, url: `/v1/comments/${target}/pin`, headers: AS.creator });

      await pin(id);
      expect((await pin(other)).json().isPinned).toBe(true);
      const pinned = (await list())
        .json()
        .items.filter((item: { isPinned: boolean }) => item.isPinned);
      expect(pinned.map((item: { id: string }) => item.id)).toEqual([other]);

      expect((await pin(other, 'DELETE')).json().isPinned).toBe(false);
    });

    it('refuses to pin a reply with 409', async () => {
      const reply = await comment('stranger', 'reply', id);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/comments/${reply}/pin`,
        headers: AS.creator,
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe(ErrorCodes.COMMENT_NOT_PINNABLE);
    });
  });
});

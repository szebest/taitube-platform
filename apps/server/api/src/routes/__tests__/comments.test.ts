import { ErrorCodes } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import {
  ABSENT,
  AS,
  AUTHOR,
  type CommentsApp,
  PRIVATE_VIDEO,
  VIDEO,
  buildCommentsApp,
} from '../../__tests__/comments-app';

describe('comment routes', () => {
  let ctx: CommentsApp;

  beforeEach(async () => {
    ctx = await buildCommentsApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it.each([
    { method: 'POST' as const, url: `/v1/videos/${VIDEO}/comments` },
    { method: 'PATCH' as const, url: `/v1/comments/${ABSENT}` },
    { method: 'DELETE' as const, url: `/v1/comments/${ABSENT}` },
    { method: 'POST' as const, url: `/v1/comments/${ABSENT}/pin` },
    { method: 'DELETE' as const, url: `/v1/comments/${ABSENT}/pin` },
  ])('refuses an anonymous $method $url with 401', async ({ method, url }) => {
    const res = await ctx.app.inject({ method, url, payload: { content: 'x' } });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('creates a comment with its author channel and counts it', async () => {
    const res = await ctx.post('author', { content: '  first!  ' });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      videoId: VIDEO,
      parentId: null,
      content: 'first!',
      isPinned: false,
      replyCount: 0,
      author: { userId: AUTHOR, handle: 'author', isCreator: false },
    });
    expect((await ctx.list()).json().total).toBe(1);
  });

  it('badges the video owner as the creator', async () => {
    expect((await ctx.post('creator', { content: 'thanks all' })).json().author.isCreator).toBe(
      true
    );
  });

  it('threads replies one level deep, a reply to a reply joining the root', async () => {
    const root = await ctx.comment('author', 'root');
    const reply = await ctx.comment('stranger', 'reply', root);
    const nested = await ctx.post('creator', { content: 'nested', parentId: reply });

    expect(nested.json().parentId).toBe(root);

    const replies = await ctx.app.inject({ method: 'GET', url: `/v1/comments/${root}/replies` });
    expect(replies.json().items.map((item: { id: string }) => item.id)).toEqual([
      reply,
      nested.json().id,
    ]);
    const [thread] = (await ctx.list()).json().items;
    expect(thread).toMatchObject({ id: root, replyCount: 2 });
    expect((await ctx.list()).json().total).toBe(3);
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
    const res = await ctx.post('author', payload);

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
    const res = await ctx.post(
      'stranger',
      { content: 'hi', ...(parentId ? { parentId } : {}) },
      video
    );

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(code);
  });

  describe('listing', () => {
    it('ranks the pinned comment first, then walks the rest by keyset cursor', async () => {
      const first = await ctx.comment('author', 'one');
      const second = await ctx.comment('stranger', 'two');
      const third = await ctx.comment('author', 'three');
      await ctx.app.inject({
        method: 'POST',
        url: `/v1/comments/${first}/pin`,
        headers: AS.creator,
      });

      const page1 = (await ctx.list('?sort=newest&limit=2')).json();
      const page2 = (await ctx.list(`?sort=newest&limit=2&cursor=${page1.nextCursor}`)).json();

      expect(page1.items.map((item: { id: string }) => item.id)).toEqual([first, third]);
      expect(page2.items.map((item: { id: string }) => item.id)).toEqual([second]);
      expect(page2.nextCursor).toBeNull();
      expect(page1.total).toBe(3);
    });

    it('serves the legacy page and size query', async () => {
      await ctx.comment('author', 'one');
      const second = await ctx.comment('author', 'two');
      await ctx.comment('author', 'three');

      const res = await ctx.list('?sort=newest&page=2&size=1');

      expect(res.json().items.map((item: { id: string }) => item.id)).toEqual([second]);
    });

    it('caches the first top page and purges it on the next write', async () => {
      await ctx.comment('author', 'one');
      const key = CacheKeys.videoHotComments(VIDEO);

      await ctx.list();
      expect(expectOk(await ctx.cache.get(key))).not.toBeNull();

      await ctx.comment('stranger', 'two');
      expect(expectOk(await ctx.cache.get(key))).toBeNull();
      expect((await ctx.list()).json().items).toHaveLength(2);
    });

    it.each([
      { scenario: 'an anonymous viewer', headers: {}, status: 401, code: 'UNAUTHORIZED' },
      { scenario: 'a stranger', headers: AS.stranger, status: 404, code: 'VIDEO_NOT_FOUND' },
    ])(
      'hides the comments of a private video from $scenario',
      async ({ headers, status, code }) => {
        const res = await ctx.list('', headers, PRIVATE_VIDEO);

        expect(res.statusCode).toBe(status);
        expect(res.json().code).toBe(code);
      }
    );

    it('answers 400 on a cursor it did not mint', async () => {
      expect((await ctx.list('?cursor=not-a-cursor')).statusCode).toBe(400);
    });

    it('answers 404 for the replies of a missing comment', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: `/v1/comments/${ABSENT}/replies` });

      expect(res.json().code).toBe(ErrorCodes.COMMENT_NOT_FOUND);
    });
  });
});

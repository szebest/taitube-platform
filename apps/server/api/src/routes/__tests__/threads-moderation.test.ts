import { ErrorCodes } from '@vp/errors';
import { EDITOR, MODERATOR, OWNER, type PostsApp, seedPostsApp } from '../../__tests__/posts-app';
import { type TestApp, buildTestApp, seedVideo } from '../../__tests__/test-app';

const LONG = '88888888-8888-7888-8888-888888888888';
const DURATION_MS = 100_000;

describe('thread moderation routes', () => {
  let testApp: TestApp;
  let ctx: PostsApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    testApp.repositories.clear();
    ctx = await seedPostsApp(testApp);
    await seedVideo(ctx.repositories, {
      id: LONG,
      ownerId: OWNER,
      title: 'Long',
      durationMs: DURATION_MS,
    });
    await ctx.join('editor', EDITOR);
    await ctx.join('moderator', MODERATOR);
  });

  const start = (who: 'fan' | 'stranger' | 'owner' | 'anonymous', over: object = {}) =>
    ctx.call(who, 'POST', `/v1/videos/${LONG}/threads`, {
      payload: { anchorMs: 10_000, title: 'The cut', body: '', ...over },
    });
  const started = async (who: 'fan' | 'stranger' | 'owner' = 'fan', over: object = {}) => {
    const res = await start(who, over);
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  };
  const reply = (who: 'fan' | 'stranger' | 'owner', id: string, content = 'a reply') =>
    ctx.call(who, 'POST', `/v1/threads/${id}/comments`, { payload: { content } });
  const list = (who: 'fan' | 'anonymous' = 'anonymous', video = LONG) =>
    ctx.call(who, 'GET', `/v1/videos/${video}/threads`);
  const codeOf = (res: { json(): { code: string } }) => res.json().code;

  describe('pinning', () => {
    it.each([
      { who: 'owner' as const, status: 200 },
      { who: 'editor' as const, status: 200 },
      { who: 'moderator' as const, status: 403 },
      { who: 'fan' as const, status: 403 },
      { who: 'anonymous' as const, status: 401 },
    ])('answers $status to a pin from $who', async ({ who, status }) => {
      const id = await started('stranger');

      const res = await ctx.call(who, 'POST', `/v1/threads/${id}/pin`, {
        as: who === 'editor' || who === 'moderator' ? ctx.ownerChannelId : undefined,
      });

      expect(res.statusCode).toBe(status);
    });

    it('refuses the fourth pin, repeats a pin harmlessly and unpins', async () => {
      const ids: string[] = [];
      for (const [who, anchorMs] of [
        ['fan', 1_000],
        ['stranger', 2_000],
        ['owner', 3_000],
      ] as const) {
        ids.push(await started(who, { anchorMs }));
      }
      const fourth = await started('fan', { anchorMs: 4_000 });
      const pin = (id: string, method: 'POST' | 'DELETE' = 'POST') =>
        ctx.call('owner', method, `/v1/threads/${id}/pin`);
      for (const id of ids) expect((await pin(id)).statusCode).toBe(200);

      const refused = await pin(fourth);
      const again = await pin(ids[0] as string);
      const unpinned = await pin(ids[0] as string, 'DELETE');

      expect([refused.statusCode, codeOf(refused)]).toEqual([409, ErrorCodes.THREAD_PIN_LIMIT]);
      expect(again.json().isPinned).toBe(true);
      expect(unpinned.json().isPinned).toBe(false);
      expect((await pin(fourth)).statusCode).toBe(200);
    });
  });

  describe('removing', () => {
    it('lets a moderator remove silently with the replies and tells nobody', async () => {
      const id = await started('fan');
      await reply('stranger', id);

      const res = await ctx.call('moderator', 'POST', `/v1/threads/${id}/remove`, {
        payload: { disclosure: 'silent' },
        as: ctx.ownerChannelId,
      });

      expect(res.statusCode).toBe(204);
      expect((await list()).json().items).toEqual([]);
      expect((await ctx.call('anonymous', 'GET', `/v1/threads/${id}/comments`)).statusCode).toBe(
        404
      );
      const removals = await ctx.call('fan', 'GET', '/v1/me/comment-removals');
      expect(removals.json().items).toEqual([]);
    });

    it('tells the author why when the removal is visible, and needs a reason for it', async () => {
      const id = await started('fan');

      const missing = await ctx.call('owner', 'POST', `/v1/threads/${id}/remove`, {
        payload: { disclosure: 'visible' },
      });
      const done = await ctx.call('owner', 'POST', `/v1/threads/${id}/remove`, {
        payload: { disclosure: 'visible', reason: 'spam' },
      });
      const removals = await ctx.call('fan', 'GET', '/v1/me/comment-removals');

      expect([missing.statusCode, codeOf(missing)]).toEqual([
        409,
        ErrorCodes.MODERATION_NOT_APPLICABLE,
      ]);
      expect(done.statusCode).toBe(204);
      expect(removals.json().items).toMatchObject([
        { videoId: LONG, reason: 'spam', excerpt: 'The cut' },
      ]);
    });

    it('lets the author take their own thread down and refuses an editor and a stranger', async () => {
      const id = await started('fan');

      const editor = await ctx.call('editor', 'POST', `/v1/threads/${id}/remove`, {
        payload: {},
        as: ctx.ownerChannelId,
      });
      const stranger = await ctx.call('stranger', 'POST', `/v1/threads/${id}/remove`, {
        payload: {},
      });
      const own = await ctx.call('fan', 'POST', `/v1/threads/${id}/remove`, { payload: {} });

      expect([editor.statusCode, stranger.statusCode, own.statusCode]).toEqual([403, 403, 204]);
    });
  });
});

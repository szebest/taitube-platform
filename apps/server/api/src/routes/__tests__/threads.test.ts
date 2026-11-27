import { expectOk } from '@kit/testing/result';
import { DEFAULT_COMMENT_SETTINGS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  EDITOR,
  FAN,
  MODERATOR,
  OWNER,
  PRIVATE_VIDEO,
  type PostsApp,
  STRANGER,
  seedPostsApp,
} from '../../__tests__/posts-app';
import { type TestApp, buildTestApp, seedVideo } from '../../__tests__/test-app';
import { saveSettings } from '../../services/__tests__/comment-deps';

const LONG = '88888888-8888-7888-8888-888888888888';
const DURATION_MS = 100_000;

describe('thread routes', () => {
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

  describe('starting a thread', () => {
    it('stores it for the acting channel and lists it to everyone', async () => {
      const id = await started('fan', { anchorMs: 4_200, title: ' The cut ', body: ' why ' });

      const listed = await list('anonymous');
      const read = await ctx.call('anonymous', 'GET', `/v1/threads/${id}`);

      expect(listed.json().items).toMatchObject([
        {
          id,
          anchorMs: 4_200,
          title: 'The cut',
          body: 'why',
          isPinned: false,
          replyCount: 0,
          status: 'published',
          author: { handle: 'fan' },
        },
      ]);
      expect(read.json()).toMatchObject({ id, videoId: LONG });
    });

    it.each([
      {
        name: 'an anchor past the end',
        over: { anchorMs: DURATION_MS + 1 },
        status: 422,
        code: ErrorCodes.THREAD_ANCHOR_INVALID,
      },
      {
        name: 'a blank title',
        over: { title: '  ' },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a title of 101 characters',
        over: { title: 'a'.repeat(101) },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a body of 1001 characters',
        over: { body: 'b'.repeat(1001) },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $name', async ({ over, status, code }) => {
      const res = await start('fan', over);

      expect([res.statusCode, codeOf(res)]).toEqual([status, code]);
    });

    it('refuses nobody signed in and a video the caller cannot read', async () => {
      const anonymous = await start('anonymous');
      const closed = await ctx.call('fan', 'POST', `/v1/videos/${PRIVATE_VIDEO}/threads`, {
        payload: { anchorMs: 0, title: 'x', body: '' },
      });

      expect(anonymous.statusCode).toBe(401);
      expect(closed.statusCode).toBe(403);
    });

    it('refuses the sixth open thread of a viewer and lets another viewer start one', async () => {
      for (let n = 0; n < 5; n += 1) await started('fan', { anchorMs: n * 1_000 });

      const sixth = await start('fan');
      const other = await start('stranger');

      expect([sixth.statusCode, codeOf(sixth)]).toEqual([429, ErrorCodes.THREAD_LIMIT]);
      expect(other.statusCode).toBe(201);
    });

    it('follows the comment rules of the channel: comments off and bans', async () => {
      await saveSettings(ctx.repositories, ctx.ownerChannelId, DEFAULT_COMMENT_SETTINGS);
      expectOk(
        await ctx.repositories.channelUserRestrictions.apply({
          channelId: ctx.ownerChannelId,
          userId: FAN,
          kind: 'ban',
          reason: 'spam',
          expiresAt: null,
          createdBy: OWNER,
        })
      );

      const banned = await start('fan');

      expect([banned.statusCode, codeOf(banned)]).toEqual([403, ErrorCodes.COMMENTS_BANNED]);
    });

    it('holds a thread under review and shows it to its author only', async () => {
      await saveSettings(ctx.repositories, ctx.ownerChannelId, {
        ...DEFAULT_COMMENT_SETTINGS,
        reviewMode: 'all',
      });

      const id = await started('fan');

      const own = (await list('fan')).json().items;
      const public_ = (await list('anonymous')).json().items;
      const read = await ctx.call('anonymous', 'GET', `/v1/threads/${id}`);

      expect(own).toMatchObject([{ id, status: 'held' }]);
      expect(public_).toEqual([]);
      expect(read.statusCode).toBe(404);
    });
  });

  describe('replies', () => {
    it('lists replies under the thread and counts them', async () => {
      const id = await started();

      const posted = await reply('stranger', id, 'same here');
      const comments = await ctx.call('anonymous', 'GET', `/v1/threads/${id}/comments`);

      expect(posted.statusCode).toBe(201);
      expect(posted.json().target).toEqual({ type: 'thread', id });
      expect(comments.json()).toMatchObject({ total: 1, items: [{ content: 'same here' }] });
      expect((await list()).json().items[0]).toMatchObject({ replyCount: 1 });
    });

    it('refuses a banned replier and holds a reply under review', async () => {
      const id = await started();
      expectOk(
        await ctx.repositories.channelUserRestrictions.apply({
          channelId: ctx.ownerChannelId,
          userId: STRANGER,
          kind: 'ban',
          reason: 'spam',
          expiresAt: null,
          createdBy: OWNER,
        })
      );

      const banned = await reply('stranger', id);

      expect([banned.statusCode, codeOf(banned)]).toEqual([403, ErrorCodes.COMMENTS_BANNED]);
    });

    it('leaves a shadow banned replier out of the counts', async () => {
      const id = await started('owner');
      expectOk(
        await ctx.repositories.channelUserRestrictions.apply({
          channelId: ctx.ownerChannelId,
          userId: STRANGER,
          kind: 'shadow',
          reason: null,
          expiresAt: null,
          createdBy: OWNER,
        })
      );

      await reply('stranger', id);

      expect((await list()).json().items[0]).toMatchObject({ replyCount: 0 });
    });

    it('answers a thread that is not there as not found', async () => {
      const res = await reply('fan', '99999999-9999-7999-8999-999999999999');

      expect([res.statusCode, codeOf(res)]).toEqual([404, ErrorCodes.THREAD_NOT_FOUND]);
    });
  });

  describe('markers', () => {
    it('draws one after two replies from two viewers, not before', async () => {
      const id = await started('fan');
      await reply('stranger', id);
      await reply('stranger', id);
      const before = (await list()).json().markers;

      await reply('owner', id);
      const after = (await list()).json().markers;

      expect(before).toEqual([]);
      expect(after).toEqual([{ anchorMs: 10_000, threadId: id, threadIds: [id], count: 1 }]);
    });

    it('draws one for a pinned thread and merges nearby anchors into one with a count', async () => {
      const a = await started('fan', { anchorMs: 10_000 });
      const b = await started('stranger', { anchorMs: 10_500 });
      await ctx.call('owner', 'POST', `/v1/threads/${a}/pin`);
      await ctx.call('owner', 'POST', `/v1/threads/${b}/pin`);

      const { markers } = (await list()).json();

      expect(markers).toMatchObject([{ anchorMs: 10_000, count: 2 }]);
    });
  });
});

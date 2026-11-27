import { expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  FAN,
  type PostsApp,
  seedPostsApp,
  STRANGER,
  textBody,
  VIDEO,
} from '../../__tests__/posts-app';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';

describe('post routes', () => {
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
  });

  const codeOf = (res: { json(): { code: string } }) => res.json().code;

  describe('likes', () => {
    it('counts a like once however often it is sent and takes it back once', async () => {
      const id = await ctx.text('owner', 'like me');
      const url = `/v1/posts/${id}/reactions`;

      const sent = [];
      for (const method of ['PUT', 'PUT', 'DELETE', 'DELETE'] as const) {
        sent.push((await ctx.call('stranger', method, url)).json());
      }

      expect(sent).toEqual([
        { postId: id, liked: true, likeCount: 1 },
        { postId: id, liked: true, likeCount: 1 },
        { postId: id, liked: false, likeCount: 0 },
        { postId: id, liked: false, likeCount: 0 },
      ]);
    });

    it('shows each viewer their own like on the post and on the channel list', async () => {
      const id = await ctx.text('owner', 'like me');
      await ctx.call('stranger', 'PUT', `/v1/posts/${id}/reactions`);

      const liked = await ctx.call('stranger', 'GET', '/v1/channels/owner/posts');
      const other = await ctx.call('fan', 'GET', `/v1/posts/${id}`);

      expect(liked.json().items).toMatchObject([{ id, likeCount: 1, likedByViewer: true }]);
      expect(other.json()).toMatchObject({ likeCount: 1, likedByViewer: false });
    });

    it.each(['PUT', 'DELETE'] as const)(
      'answers 404 for %s on a post that is not there',
      async (method) => {
        const res = await ctx.call('stranger', method, `/v1/posts/${ABSENT}/reactions`);

        expect([res.statusCode, codeOf(res)]).toEqual([404, ErrorCodes.POST_NOT_FOUND]);
      }
    );
  });

  describe('listing', () => {
    it('lists the pinned post first, then newest first, and walks the keyset to the end', async () => {
      const [oldest, middle, newest] = [
        await ctx.text('owner', 'oldest'),
        await ctx.text('owner', 'middle'),
        await ctx.text('owner', 'newest'),
      ];
      const pinned = ctx.repositories.channelPosts.posts.get(oldest);
      if (pinned) pinned.pinnedAt = new Date();

      const first = (await ctx.call('anonymous', 'GET', '/v1/channels/owner/posts?limit=2')).json();
      const second = (
        await ctx.call(
          'anonymous',
          'GET',
          `/v1/channels/${ctx.ownerChannelId}/posts?limit=2&cursor=${first.nextCursor}`
        )
      ).json();

      expect(first.items.map(({ id }: { id: string }) => id)).toEqual([oldest, newest]);
      expect(second.items.map(({ id }: { id: string }) => id)).toEqual([middle]);
      expect(second.nextCursor).toBeNull();
    });

    it.each([
      {
        scenario: 'an unknown channel',
        url: '/v1/channels/nobody/posts',
        status: 404,
        code: ErrorCodes.CHANNEL_NOT_FOUND,
      },
      {
        scenario: 'a broken cursor',
        url: '/v1/channels/owner/posts?cursor=!!',
        status: 400,
        code: ErrorCodes.INVALID_CURSOR,
      },
    ])('refuses $scenario', async ({ url, status, code }) => {
      const res = await ctx.call('anonymous', 'GET', url);

      expect([res.statusCode, codeOf(res)]).toEqual([status, code]);
    });

    it('answers 404 for a post that is not there', async () => {
      const res = await ctx.call('anonymous', 'GET', `/v1/posts/${ABSENT}`);

      expect([res.statusCode, codeOf(res)]).toEqual([404, ErrorCodes.POST_NOT_FOUND]);
    });
  });

  describe('community feed', () => {
    it('shows posts of the subscribed channels only, newest first', async () => {
      const older = await ctx.text('owner', 'older');
      const newer = await ctx.text('owner', 'newer');
      await ctx.repositories.channels.create({
        userId: STRANGER,
        handle: 'other',
        displayName: 'Other',
      });
      await ctx.text('stranger', 'not followed');
      expectOk(
        await ctx.repositories.subscriptions.subscribe(FAN, ctx.fanChannelId, ctx.ownerChannelId)
      );

      const feed = (await ctx.call('fan', 'GET', '/v1/feed/community')).json();
      const nobody = (await ctx.call('stranger', 'GET', '/v1/feed/community')).json();

      expect(feed.items.map(({ id }: { id: string }) => id)).toEqual([newer, older]);
      expect(nobody.items).toEqual([]);
    });
  });

  describe('comments under a post', () => {
    it('creates, lists and counts comments, with POST_NOT_FOUND for a post that is not there', async () => {
      const id = await ctx.text('owner', 'discuss');

      const created = await ctx.call('stranger', 'POST', `/v1/posts/${id}/comments`, {
        payload: { content: 'hi' },
      });
      const listed = await ctx.call('anonymous', 'GET', `/v1/posts/${id}/comments`);
      const post = await ctx.call('anonymous', 'GET', `/v1/posts/${id}`);
      const missing = await ctx.call('stranger', 'POST', `/v1/posts/${ABSENT}/comments`, {
        payload: { content: 'x' },
      });

      expect(created.json()).toMatchObject({
        target: { type: 'post', id },
        videoId: null,
        content: 'hi',
      });
      expect(listed.json()).toMatchObject({ total: 1, items: [{ content: 'hi' }] });
      expect(post.json().commentsCount).toBe(1);
      expect([missing.statusCode, codeOf(missing)]).toEqual([404, ErrorCodes.POST_NOT_FOUND]);
    });

    it('refuses a comment on a post whose replies are off with 403', async () => {
      const res = await ctx.publish('owner', { ...textBody('quiet'), commentsEnabled: false });

      const comment = await ctx.call('stranger', 'POST', `/v1/posts/${res.json().id}/comments`, {
        payload: { content: 'hi' },
      });

      expect([comment.statusCode, codeOf(comment)]).toEqual([403, ErrorCodes.COMMENTS_DISABLED]);
    });

    it('leaves the comments of a video where they were', async () => {
      const created = await ctx.call('stranger', 'POST', `/v1/videos/${VIDEO}/comments`, {
        payload: { content: 'on the video' },
      });
      const listed = await ctx.call('anonymous', 'GET', `/v1/videos/${VIDEO}/comments`);

      expect(created.json()).toMatchObject({
        target: { type: 'video', id: VIDEO },
        videoId: VIDEO,
      });
      expect(listed.json()).toMatchObject({ total: 1, items: [{ content: 'on the video' }] });
    });
  });
});

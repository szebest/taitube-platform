import { expectOk } from '@kit/testing/result';
import { POSTS_PER_DAY, type PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  EDITOR,
  FAN,
  MODERATOR,
  OWNER,
  PRIVATE_VIDEO,
  type PostsApp,
  STRANGER,
  VIDEO,
  seedPostsApp,
  textBody,
} from '../../__tests__/posts-app';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';

const PLAYLIST = '88888888-8888-7888-8888-888888888888';

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

  const threadsOf = async (id: string) =>
    expectOk(
      await ctx.repositories.comments.listThreads(
        { type: 'post', id },
        { viewer: null, sort: 'newest', window: { type: 'keyset', cursor: null, limit: 10 } }
      )
    );

  it.each([
    { method: 'POST' as const, url: '/v1/me/channel/posts', payload: textBody('x') },
    {
      method: 'PATCH' as const,
      url: `/v1/me/channel/posts/${ABSENT}`,
      payload: { ...textBody('x'), version: 1 },
    },
    { method: 'DELETE' as const, url: `/v1/me/channel/posts/${ABSENT}` },
    { method: 'PUT' as const, url: `/v1/posts/${ABSENT}/reactions` },
    { method: 'DELETE' as const, url: `/v1/posts/${ABSENT}/reactions` },
    { method: 'GET' as const, url: '/v1/feed/community' },
    { method: 'POST' as const, url: `/v1/posts/${ABSENT}/comments`, payload: { content: 'x' } },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await ctx.call('anonymous', method, url, { payload });

    expect(res.statusCode).toBe(401);
    expect(codeOf(res)).toBe(ErrorCodes.UNAUTHORIZED);
  });

  describe('publishing', () => {
    const images = (uploadId: string): PostPayload => ({
      kind: 'images',
      images: [{ uploadId, alt: 'a cat' }],
      caption: 'cat',
    });

    it.each([
      {
        scenario: 'a text post',
        payload: async (): Promise<PostPayload> => ({ kind: 'text', text: ' hello ' }),
        expected: { kind: 'text', body: { kind: 'text', text: 'hello' } },
      },
      {
        scenario: 'a post of images',
        payload: async (app: PostsApp): Promise<PostPayload> => {
          const { uploadId } = await readyUpload(app);
          return images(uploadId);
        },
        expected: { kind: 'images', body: { kind: 'images', caption: 'cat' } },
      },
      {
        scenario: 'a shared video at a moment',
        payload: async (): Promise<PostPayload> => ({
          kind: 'video_share',
          videoId: VIDEO,
          comment: 'watch this',
          startMs: 9000,
        }),
        expected: {
          kind: 'video_share',
          body: {
            comment: 'watch this',
            startMs: 9000,
            card: { type: 'video', id: VIDEO, title: 'Open' },
          },
        },
      },
      {
        scenario: 'a shared playlist',
        payload: async (app: PostsApp): Promise<PostPayload> => {
          await app.repositories.playlists.create({
            id: PLAYLIST,
            ownerId: OWNER,
            title: 'Favourites',
            description: '',
            visibility: 'public',
          });
          return { kind: 'playlist_share', playlistId: PLAYLIST, comment: null };
        },
        expected: {
          kind: 'playlist_share',
          body: { card: { type: 'playlist', id: PLAYLIST, title: 'Favourites', itemCount: 0 } },
        },
      },
    ])('publishes $scenario, readable by anyone', async ({ payload, expected }) => {
      const res = await ctx.publish('owner', {
        payload: await payload(ctx),
        commentsEnabled: true,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        ...expected,
        channel: { id: ctx.ownerChannelId, handle: 'owner' },
        likedByViewer: false,
        version: 1,
      });
      const read = await ctx.call('anonymous', 'GET', `/v1/posts/${res.json().id}`);
      expect(read.json()).toEqual(res.json());
    });

    it('keeps the replies switch the post was published with', async () => {
      const res = await ctx.publish('owner', { ...textBody('quiet'), commentsEnabled: false });

      expect(res.json().commentsEnabled).toBe(false);
    });

    it('lets an editor publish, and the post shows the channel, never the member', async () => {
      await ctx.join('editor', EDITOR);

      const res = await ctx.publish('editor', textBody('from the team'), ctx.ownerChannelId);

      expect(res.statusCode).toBe(201);
      expect(res.json().channel).toMatchObject({ id: ctx.ownerChannelId, handle: 'owner' });
      expect(res.body).not.toContain(EDITOR);
      expect(res.body).not.toContain('authorUserId');
      const audit = expectOk(
        await ctx.repositories.channelAudit.list(ctx.ownerChannelId, { cursor: null, limit: 5 })
      );
      expect(audit[0]).toMatchObject({ action: 'post.published', actorUserId: EDITOR });
    });

    it.each([
      {
        scenario: 'a moderator of the channel',
        who: 'moderator' as const,
        join: MODERATOR,
        code: ErrorCodes.FORBIDDEN,
      },
      {
        scenario: 'a stranger naming the channel',
        who: 'stranger' as const,
        join: null,
        code: ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
      },
    ])('refuses $scenario with 403', async ({ who, join, code }) => {
      if (join) await ctx.join('moderator', join);

      const res = await ctx.publish(who, textBody('no'), ctx.ownerChannelId);

      expect([res.statusCode, codeOf(res)]).toEqual([403, code]);
    });

    it('lets the twentieth post of the day through and refuses the next with 429', async () => {
      for (let count = 1; count <= POSTS_PER_DAY; count += 1) {
        await ctx.text('owner', `post ${count}`);
      }

      const res = await ctx.publish('owner', textBody('one too many'));

      expect([res.statusCode, codeOf(res)]).toEqual([429, ErrorCodes.POST_DAILY_LIMIT]);
    });

    it.each([
      {
        scenario: 'private video',
        payload: { kind: 'video_share', videoId: PRIVATE_VIDEO, comment: null, startMs: null },
      },
      {
        scenario: 'missing video',
        payload: { kind: 'video_share', videoId: ABSENT, comment: null, startMs: null },
      },
      {
        scenario: 'missing playlist',
        payload: { kind: 'playlist_share', playlistId: ABSENT, comment: null },
      },
    ] as const)('refuses to share a $scenario with 422', async ({ payload }) => {
      const res = await ctx.publish('owner', { payload, commentsEnabled: true });

      expect([res.statusCode, codeOf(res)]).toEqual([422, ErrorCodes.POST_SHARE_NOT_PUBLIC]);
    });

    it('shows an unavailable card, with nothing of the video, once the video turns private', async () => {
      const res = await ctx.publish('owner', {
        payload: { kind: 'video_share', videoId: VIDEO, comment: 'was good', startMs: 1 },
        commentsEnabled: true,
      });
      const stored = expectOk(await ctx.repositories.videos.findById(VIDEO));
      if (stored) stored.visibility = 'private';

      const read = await ctx.call('anonymous', 'GET', `/v1/posts/${res.json().id}`);

      expect(read.json().body).toEqual({
        kind: 'video_share',
        comment: 'was good',
        startMs: 1,
        card: { type: 'unavailable' },
      });
      expect(read.body).not.toContain('Open');
    });

    it.each([
      { scenario: 'blank text', payload: { kind: 'text', text: '  ' }, status: 422 },
      { scenario: 'a kind that does not exist', payload: { kind: 'poll' }, status: 400 },
      { scenario: 'text that is not text', payload: { kind: 'text', text: 3 }, status: 400 },
    ])('refuses $scenario with $status', async ({ payload, status }) => {
      const res = await ctx.call('owner', 'POST', '/v1/me/channel/posts', { payload: { payload } });

      expect(res.statusCode).toBe(status);
      expect(codeOf(res)).toBe(ErrorCodes.VALIDATION_FAILED);
    });
  });

  describe('editing and deleting', () => {
    it('edits against the version and answers 409 for a stale one', async () => {
      const id = await ctx.text('owner', 'first');
      const url = `/v1/me/channel/posts/${id}`;

      const edited = await ctx.call('owner', 'PATCH', url, {
        payload: { payload: textBody('second').payload, version: 1 },
      });
      const stale = await ctx.call('owner', 'PATCH', url, {
        payload: { payload: textBody('third').payload, version: 1 },
      });

      expect(edited.json()).toMatchObject({
        body: { text: 'second' },
        isEdited: true,
        version: 2,
        commentsEnabled: true,
      });
      expect([stale.statusCode, codeOf(stale)]).toEqual([409, ErrorCodes.VERSION_CONFLICT]);
    });

    it('lets an editor edit and delete, and answers 404 for a post that is not there', async () => {
      await ctx.join('editor', EDITOR);
      const id = await ctx.text('owner', 'mine');
      const as = ctx.ownerChannelId;

      const edited = await ctx.call('editor', 'PATCH', `/v1/me/channel/posts/${id}`, {
        payload: { payload: textBody('theirs').payload, version: 1 },
        as,
      });
      const removed = await ctx.call('editor', 'DELETE', `/v1/me/channel/posts/${id}`, { as });
      const again = await ctx.call('editor', 'DELETE', `/v1/me/channel/posts/${id}`, { as });

      expect([edited.statusCode, removed.statusCode, again.statusCode]).toEqual([200, 204, 404]);
      expect(codeOf(again)).toBe(ErrorCodes.POST_NOT_FOUND);
    });

    it('refuses a moderator an edit and a delete with 403', async () => {
      await ctx.join('moderator', MODERATOR);
      const id = await ctx.text('owner', 'mine');
      const as = ctx.ownerChannelId;

      const edited = await ctx.call('moderator', 'PATCH', `/v1/me/channel/posts/${id}`, {
        payload: { payload: textBody('x').payload, version: 1 },
        as,
      });
      const removed = await ctx.call('moderator', 'DELETE', `/v1/me/channel/posts/${id}`, { as });

      expect([edited.statusCode, removed.statusCode]).toEqual([403, 403]);
    });

    it('answers 404 for a post of another channel', async () => {
      const id = await ctx.text('owner', 'mine');

      const res = await ctx.call('fan', 'DELETE', `/v1/me/channel/posts/${id}`);

      expect([res.statusCode, codeOf(res)]).toEqual([404, ErrorCodes.POST_NOT_FOUND]);
    });

    it('takes the comments of a post with it', async () => {
      const id = await ctx.text('owner', 'discuss');
      const comment = await ctx.call('stranger', 'POST', `/v1/posts/${id}/comments`, {
        payload: { content: 'first!' },
      });
      expect(comment.statusCode).toBe(201);
      expect(await threadsOf(id)).toHaveLength(1);

      const removed = await ctx.call('owner', 'DELETE', `/v1/me/channel/posts/${id}`);

      expect(removed.statusCode).toBe(204);
      expect(await threadsOf(id)).toEqual([]);
      const list = await ctx.call('anonymous', 'GET', `/v1/posts/${id}/comments`);
      expect([list.statusCode, codeOf(list)]).toEqual([404, ErrorCodes.POST_NOT_FOUND]);
    });
  });

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

async function readyUpload(app: PostsApp): Promise<{ uploadId: string }> {
  const uploadId = '00000000-0000-7000-8000-0000000012d1';
  const { channelImages } = app.repositories;
  expectOk(
    await channelImages.create({
      id: uploadId,
      channelId: app.ownerChannelId,
      uploadedBy: OWNER,
      kind: 'post-image',
      contentType: 'image/png',
      sizeBytes: 10,
    })
  );
  expectOk(
    await channelImages.queue(uploadId, {
      width: 100,
      height: 100,
      crops: { kind: 'post-image', crop: { x: 0, y: 0, width: 100, height: 100 } },
    })
  );
  expectOk(
    await channelImages.commit(uploadId, 'https://cdn.test/a-640.webp', {
      w640: 'https://cdn.test/a-640.webp',
      w1280: 'https://cdn.test/a-1280.webp',
    })
  );
  return { uploadId };
}

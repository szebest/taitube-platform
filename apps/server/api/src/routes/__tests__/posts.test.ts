import { expectOk } from '@kit/testing/result';
import { POSTS_PER_DAY, type PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  EDITOR,
  MODERATOR,
  OWNER,
  type PostsApp,
  PRIVATE_VIDEO,
  seedPostsApp,
  textBody,
  VIDEO,
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
      expect(res.json()).toMatchObject(read.json());
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

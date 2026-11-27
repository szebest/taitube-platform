import { expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import {
  EDITOR,
  MODERATOR,
  type PostsApp,
  seedPostsApp,
  textBody,
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

  const threadsOf = async (id: string) =>
    expectOk(
      await ctx.repositories.comments.listThreads(
        { type: 'post', id },
        { viewer: null, sort: 'newest', window: { type: 'keyset', cursor: null, limit: 10 } }
      )
    );

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
});

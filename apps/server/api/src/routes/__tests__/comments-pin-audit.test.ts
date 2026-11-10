import type { CommentActionBody } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  CREATOR,
  VIDEO,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';

const HIDE: CommentActionBody = { action: 'hide', disclosure: 'silent' };

describe('comment pin and delete audit routes', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const moderate = (id: string, payload: CommentActionBody, who: Who = 'creator') =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${id}/moderate`,
      headers: AS[who],
      payload,
    });
  const roots = async () => (await ctx.list()).json();
  const audited = async () =>
    expectOk(await ctx.repositories.channelAudit.list(channelId, { cursor: null, limit: 20 }))
      .map(({ action, actorUserId, meta }) => ({ action, actorUserId, meta }))
      .reverse();

  beforeEach(async () => {
    ctx = await buildCommentsApp();
    channelId = expectOk(
      await ctx.repositories.channels.create({
        userId: CREATOR,
        handle: 'creator',
        displayName: 'Creator',
      })
    ).id;
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const pin = (id: string, method: 'POST' | 'DELETE' = 'POST', who: Who = 'creator') =>
    ctx.app.inject({ method, url: `/v1/comments/${id}/pin`, headers: AS[who] });

  it.each([
    { action: 'hold', disclosure: 'silent' },
    { action: 'hide', disclosure: 'silent' },
  ] as const)(
    'refuses to pin a comment that %o took out of public reads, with 409',
    async (action) => {
      const id = await ctx.comment('author', 'hello');
      await moderate(id, action);

      const res = await pin(id);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe(ErrorCodes.COMMENT_NOT_PINNABLE);
    }
  );

  it('unpins a pinned comment when it is hidden, and logs each pin and unpin', async () => {
    const id = await ctx.comment('author', 'hello');
    await pin(id);
    await pin(id, 'DELETE');
    await pin(id);

    await moderate(id, HIDE);
    await moderate(id, { action: 'unhide' });

    const listed = (await roots()).items;
    expect(listed).toMatchObject([{ id, isPinned: false }]);
    expect((await audited()).map(({ action, meta }) => [action, meta])).toEqual([
      ['comment.pinned', { videoId: VIDEO, pinned: true }],
      ['comment.pinned', { videoId: VIDEO, pinned: false }],
      ['comment.pinned', { videoId: VIDEO, pinned: true }],
      ['comment.hidden', { videoId: VIDEO, disclosure: 'silent' }],
      ['comment.unhidden', { videoId: VIDEO, disclosure: 'silent' }],
    ]);
  });

  it.each([
    { who: 'creator', logged: true },
    { who: 'author', logged: false },
  ] as const)(
    'logs a delete by the $who silently only when it is a moderator: $logged',
    async ({ who, logged }) => {
      const id = await ctx.comment('author', 'hello');

      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/v1/comments/${id}`,
        headers: AS[who],
      });

      expect(res.statusCode).toBe(204);
      expect(await audited()).toEqual(
        logged
          ? [
              {
                action: 'comment.removed',
                actorUserId: CREATOR,
                meta: { videoId: VIDEO, disclosure: 'silent' },
              },
            ]
          : []
      );
    }
  );
});

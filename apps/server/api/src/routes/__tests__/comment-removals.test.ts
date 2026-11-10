import type { CommentActionBody } from '@vp/api-contracts';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  VIDEO,
  CREATOR,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';

describe('GET /v1/me/comment-removals', () => {
  let ctx: CommentsApp;

  const moderate = (id: string, payload: CommentActionBody) =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${id}/moderate`,
      headers: AS.creator,
      payload,
    });
  const removals = (who: Who = 'author', query = '') =>
    ctx.app.inject({ method: 'GET', url: `/v1/me/comment-removals${query}`, headers: AS[who] });
  const notices = () =>
    ctx.repositories.outbox
      .getAll()
      .filter((row) => JSON.stringify(row.payload).includes('notify-moderation'));

  beforeEach(async () => {
    ctx = await buildCommentsApp();
    expectOk(
      await ctx.repositories.channels.create({
        userId: CREATOR,
        handle: 'creator',
        displayName: 'Creator',
      })
    );
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('lists the visible removals of the caller with the reason, and no silent one', async () => {
    const loud = await ctx.comment('author', 'a comment that earns a reason');
    const quiet = await ctx.comment('author', 'a comment removed quietly');
    await moderate(loud, {
      action: 'remove',
      disclosure: 'visible',
      reason: 'spam',
      note: 'twice',
    });
    await moderate(quiet, { action: 'remove', disclosure: 'silent' });

    const res = await removals();

    expect(res.statusCode).toBe(200);
    expect(res.json().items).toMatchObject([
      {
        id: loud,
        videoId: VIDEO,
        excerpt: 'a comment that earns a reason',
        reason: 'spam',
        note: 'twice',
      },
    ]);
    expect((await removals('stranger')).json().items).toEqual([]);
  });

  it('creates one notification job for a visible hold, hide or removal and none for a silent action', async () => {
    const [hold, hide, remove, quiet] = [
      await ctx.comment('author', 'one'),
      await ctx.comment('author', 'two'),
      await ctx.comment('author', 'three'),
      await ctx.comment('author', 'four'),
    ];

    await moderate(hold, { action: 'hold', disclosure: 'visible', reason: 'spam' });
    await moderate(hide, { action: 'hide', disclosure: 'visible', reason: 'harassment' });
    await moderate(remove, { action: 'remove', disclosure: 'visible', reason: 'off_topic' });
    await moderate(quiet, { action: 'hide', disclosure: 'silent' });
    await moderate(hold, { action: 'approve' });

    expect(notices()).toHaveLength(3);
  });

  it('refuses an anonymous caller with 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/me/comment-removals' });

    expect(res.statusCode).toBe(401);
  });
});

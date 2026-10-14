import { ErrorCodes } from '@vp/errors';
import { AS, type CommentsApp, type Who, buildCommentsApp } from './comments-app';

describe('comment moderation routes', () => {
  let ctx: CommentsApp;
  let id: string;

  beforeEach(async () => {
    ctx = await buildCommentsApp();
    id = await ctx.comment('author', 'original');
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it.each<{ who: Who; status: number }>([
    { who: 'author', status: 200 },
    { who: 'creator', status: 403 },
    { who: 'moderator', status: 403 },
    { who: 'stranger', status: 403 },
  ])('lets only the author edit: $who gets $status', async ({ who, status }) => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/comments/${id}`,
      headers: AS[who],
      payload: { content: 'rewritten' },
    });

    expect(res.statusCode).toBe(status);
    if (status === 200) expect(res.json()).toMatchObject({ content: 'rewritten', isEdited: true });
  });

  it.each<{ who: Who; status: number }>([
    { who: 'author', status: 204 },
    { who: 'creator', status: 204 },
    { who: 'moderator', status: 204 },
    { who: 'admin', status: 204 },
    { who: 'stranger', status: 403 },
  ])('deletes for $who with $status', async ({ who, status }) => {
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/comments/${id}`,
      headers: AS[who],
    });

    expect(res.statusCode).toBe(status);
    expect((await ctx.list()).json().total).toBe(status === 204 ? 0 : 1);
  });

  it('takes a deleted root and its replies off the count', async () => {
    await ctx.comment('stranger', 'reply', id);

    await ctx.app.inject({ method: 'DELETE', url: `/v1/comments/${id}`, headers: AS.creator });

    expect((await ctx.list()).json()).toMatchObject({ items: [], total: 0 });
    const gone = await ctx.app.inject({
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
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${id}/pin`,
      headers: AS[who],
    });

    expect(res.statusCode).toBe(status);
  });

  it('moves the pin to the newly pinned comment and unpins on DELETE', async () => {
    const other = await ctx.comment('stranger', 'better');
    const pin = (target: string, method: 'POST' | 'DELETE' = 'POST') =>
      ctx.app.inject({ method, url: `/v1/comments/${target}/pin`, headers: AS.creator });

    await pin(id);
    expect((await pin(other)).json().isPinned).toBe(true);
    const pinned = (await ctx.list())
      .json()
      .items.filter((item: { isPinned: boolean }) => item.isPinned);
    expect(pinned.map((item: { id: string }) => item.id)).toEqual([other]);

    expect((await pin(other, 'DELETE')).json().isPinned).toBe(false);
  });

  it('refuses to pin a reply with 409', async () => {
    const reply = await ctx.comment('stranger', 'reply', id);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${reply}/pin`,
      headers: AS.creator,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe(ErrorCodes.COMMENT_NOT_PINNABLE);
  });
});

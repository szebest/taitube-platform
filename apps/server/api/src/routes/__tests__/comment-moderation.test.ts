import type { CommentActionBody } from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  AUTHOR,
  CREATOR,
  STRANGER,
  VIDEO,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';
import { seedTeamMember } from '../../__tests__/test-app';

const HIDE: CommentActionBody = { action: 'hide', disclosure: 'silent' };

describe('POST /v1/comments/:id/moderate', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const moderate = (id: string, payload: CommentActionBody, who: Who | null = 'creator') =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${id}/moderate`,
      headers: who ? AS[who] : {},
      payload,
    });
  const roots = async (who: Who | null = null) => (await ctx.list('', who ? AS[who] : {})).json();
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

  it.each<{ role: ChannelRole | 'owner' | 'anonymous' | 'author'; status: number }>([
    { role: 'owner', status: 200 },
    { role: 'manager', status: 200 },
    { role: 'moderator', status: 200 },
    { role: 'editor', status: 403 },
    { role: 'analytics', status: 403 },
    { role: 'author', status: 403 },
    { role: 'anonymous', status: 401 },
  ])('answers a $role hiding a comment with $status', async ({ role, status }) => {
    const id = await ctx.comment('author', 'hello');
    const who: Who | null =
      role === 'owner'
        ? 'creator'
        : role === 'author'
          ? 'author'
          : role === 'anonymous'
            ? null
            : 'stranger';
    if (who === 'stranger') {
      await seedTeamMember(ctx.repositories, {
        ownerId: CREATOR,
        memberId: STRANGER,
        role: role as ChannelRole,
      });
    }

    const res = await moderate(id, HIDE, who);

    expect(res.statusCode).toBe(status);
    expect((await roots()).items.map((item: { id: string }) => item.id)).toEqual(
      status === 200 ? [] : [id]
    );
  });

  it.each([
    { action: { action: 'hold', disclosure: 'silent' }, state: 'held', total: 0 },
    { action: HIDE, state: 'hidden', total: 0 },
    { action: { action: 'remove', disclosure: 'silent' }, state: 'removed', total: 0 },
  ] as const)(
    'takes a comment out of every public read with $action.action',
    async ({ action, state, total }) => {
      const id = await ctx.comment('author', 'hello');
      await ctx.comment('stranger', 'other');
      expect((await roots()).total).toBe(2);

      const res = await moderate(id, action);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ state });
      const anonymous = await roots();
      expect([anonymous.items.length, anonymous.total]).toEqual([1, total + 1]);
    }
  );

  it('brings a held comment back with approve, and a hidden one with unhide, counts included', async () => {
    const id = await ctx.comment('author', 'hello');

    await moderate(id, { action: 'hold', disclosure: 'silent' });
    const held = await roots();
    const approved = await moderate(id, { action: 'approve' });
    await moderate(id, HIDE);
    const unhidden = await moderate(id, { action: 'unhide' });

    expect(held.total).toBe(0);
    expect(approved.json()).toMatchObject({
      state: 'published',
      comment: { id, status: 'published' },
    });
    expect(unhidden.json().state).toBe('published');
    expect((await roots()).total).toBe(1);
  });

  it.each([
    { action: 'approve', from: 'published' },
    { action: 'unhide', from: 'published' },
  ] as const)('refuses $action on a $from comment with 409', async ({ action }) => {
    const id = await ctx.comment('author', 'hello');

    const res = await moderate(id, { action });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe(ErrorCodes.MODERATION_NOT_APPLICABLE);
  });

  it('needs a reason for a visible action, and takes the channel default when no disclosure is given', async () => {
    const id = await ctx.comment('author', 'hello');

    const visible = await moderate(id, { action: 'hide', disclosure: 'visible' });
    const byDefault = await moderate(id, { action: 'remove' });
    const withReason = await moderate(id, {
      action: 'hide',
      disclosure: 'visible',
      reason: 'spam',
    });

    expect(visible.statusCode).toBe(409);
    expect(byDefault.statusCode).toBe(409);
    expect(withReason.json()).toMatchObject({
      state: 'hidden',
      comment: { status: 'hidden', moderation: { state: 'hidden', reason: 'spam' } },
    });
  });

  it('tells the author of a visible hide and nobody of a silent one', async () => {
    const loud = await ctx.comment('author', 'loud');
    const quiet = await ctx.comment('author', 'quiet');
    await moderate(loud, { action: 'hide', disclosure: 'visible', reason: 'spam' });
    await moderate(quiet, HIDE);

    const own = (await roots('author')).items;

    expect(own.find((item: { id: string }) => item.id === loud)).toMatchObject({
      status: 'hidden',
      moderation: { reason: 'spam' },
    });
    expect(own.find((item: { id: string }) => item.id === quiet)).toMatchObject({
      status: 'published',
      moderation: null,
    });
    expect((await roots('stranger')).items).toEqual([]);
  });

  it('removes the comment with its replies, keeps the reason for its author and logs the action', async () => {
    const id = await ctx.comment('author', 'hello a very long text');
    await ctx.comment('stranger', 'reply', id);

    const res = await moderate(id, { action: 'remove', disclosure: 'visible', reason: 'spam' });

    expect(res.json()).toEqual({ state: 'removed', comment: null });
    expect((await roots()).total).toBe(0);
    const removals = expectOk(
      await ctx.repositories.commentModeration.listRemovals(AUTHOR, {
        since: new Date(0),
        cursor: null,
        limit: 10,
      })
    );
    expect(removals).toMatchObject([
      { id, excerpt: 'hello a very long text', reason: 'spam', removedBy: CREATOR },
    ]);
    expect(await audited()).toEqual([
      {
        action: 'comment.removed',
        actorUserId: CREATOR,
        meta: { videoId: VIDEO, disclosure: 'visible' },
      },
    ]);
  });

  it('logs each action with the disclosure used', async () => {
    const id = await ctx.comment('author', 'hello');

    await moderate(id, { action: 'hold', disclosure: 'visible', reason: 'spam' });
    await moderate(id, { action: 'approve' });

    expect(await audited()).toEqual([
      {
        action: 'comment.held',
        actorUserId: CREATOR,
        meta: { videoId: VIDEO, disclosure: 'visible' },
      },
      {
        action: 'comment.approved',
        actorUserId: CREATOR,
        meta: { videoId: VIDEO, disclosure: 'visible' },
      },
    ]);
  });

  it('answers 404 for a comment that is not there and 400 for an unknown action', async () => {
    const missing = await moderate('99999999-9999-7999-8999-999999999999', HIDE);
    const id = await ctx.comment('author', 'hello');
    const unknown = await moderate(id, { action: 'ban' } as unknown as CommentActionBody);

    expect([missing.statusCode, unknown.statusCode]).toEqual([404, 400]);
  });

  it('never serves a hidden comment from the warm hot cache', async () => {
    const id = await ctx.comment('author', 'hello');
    await roots();

    await moderate(id, HIDE);

    expect((await roots()).items).toEqual([]);
  });
});

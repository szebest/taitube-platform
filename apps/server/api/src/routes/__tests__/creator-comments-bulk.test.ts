import { CHANNEL_HEADER } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  AUTHOR,
  CREATOR,
  STRANGER,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';
import { seedTeamMember, seedVideo } from '../../__tests__/test-app';

const ELSEWHERE_VIDEO = '88888888-8888-7888-8888-888888888888';
const ABSENT = '99999999-9999-7999-8999-999999999999';

describe('POST /v1/creator/comments/bulk', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const bulk = (payload: unknown, who: Who = 'creator') =>
    ctx.app.inject({
      method: 'POST',
      url: '/v1/creator/comments/bulk',
      headers: { ...AS[who], [CHANNEL_HEADER]: channelId },
      payload: payload as object,
    });
  const audited = async () =>
    expectOk(await ctx.repositories.channelAudit.list(channelId, { cursor: null, limit: 50 }))
      .map(({ action, targetId }) => ({ action, targetId }))
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

  it('applies the action to every comment, reports each id in order, and logs one row per comment', async () => {
    const first = await ctx.comment('author', 'one');
    const second = await ctx.comment('stranger', 'two');

    const res = await bulk({
      ids: [first, second],
      action: { action: 'hide', disclosure: 'silent' },
    });

    expect(res.json()).toEqual({
      results: [
        { id: first, ok: true },
        { id: second, ok: true },
      ],
    });
    expect((await ctx.list()).json().items).toEqual([]);
    expect(await audited()).toEqual([
      { action: 'comment.hidden', targetId: first },
      { action: 'comment.hidden', targetId: second },
    ]);
  });

  it('applies the rest and names the id that was absent, refused by its state or outside the team', async () => {
    const fine = await ctx.comment('author', 'fine');
    const hidden = await ctx.comment('author', 'hidden');
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/comments/${hidden}/moderate`,
      headers: AS.creator,
      payload: { action: 'hide', disclosure: 'silent' },
    });
    await seedVideo(ctx.repositories, { id: ELSEWHERE_VIDEO, ownerId: AUTHOR, title: 'Elsewhere' });
    const foreign = expectOk(
      await ctx.repositories.comments.create({
        id: '77777777-7777-7777-8777-777777777777',
        videoId: ELSEWHERE_VIDEO,
        authorId: STRANGER,
        parentId: null,
        content: 'not yours',
      })
    );
    await seedTeamMember(ctx.repositories, {
      ownerId: CREATOR,
      memberId: STRANGER,
      role: 'moderator',
    });

    const res = await bulk(
      {
        ids: [fine, hidden, ABSENT, foreign?.id],
        action: { action: 'hide', disclosure: 'silent' },
      },
      'stranger'
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([
      { id: fine, ok: true },
      { id: hidden, ok: false, code: ErrorCodes.MODERATION_NOT_APPLICABLE },
      { id: ABSENT, ok: false, code: ErrorCodes.COMMENT_NOT_FOUND },
      { id: foreign?.id, ok: false, code: ErrorCodes.FORBIDDEN },
    ]);
  });

  it('applies a user action once per author, whatever the number of their comments', async () => {
    const mine = await ctx.comment('author', 'one');
    const again = await ctx.comment('author', 'two');
    const theirs = await ctx.comment('stranger', 'three');

    const res = await bulk({ ids: [mine, again, theirs], action: { action: 'shadow_ban' } });

    expect(res.json().results.map((row: { ok: boolean }) => row.ok)).toEqual([true, true, true]);
    expect((await audited()).filter(({ action }) => action === 'user.shadow_banned')).toEqual([
      { action: 'user.shadow_banned', targetId: AUTHOR },
      { action: 'user.shadow_banned', targetId: STRANGER },
    ]);
    expect((await ctx.list()).json().items).toEqual([]);
  });

  it('refuses a user action on a comment outside the acting channel and lifts what it banned', async () => {
    const mine = await ctx.comment('author', 'one');
    await bulk({ ids: [mine], action: { action: 'ban', reason: 'spam' } });

    const lifted = await bulk({ ids: [mine, ABSENT], action: { action: 'lift' } });

    expect(lifted.json().results).toEqual([
      { id: mine, ok: true },
      { id: ABSENT, ok: false, code: ErrorCodes.COMMENT_NOT_FOUND },
    ]);
  });

  it.each([
    { scenario: 'no ids', payload: { ids: [], action: { action: 'approve' } } },
    {
      scenario: 'more than 100 ids',
      payload: { ids: Array.from({ length: 101 }, () => ABSENT), action: { action: 'approve' } },
    },
    { scenario: 'an unknown action', payload: { ids: [ABSENT], action: { action: 'explode' } } },
  ])('refuses $scenario with 400', async ({ payload }) => {
    expect((await bulk(payload)).statusCode).toBe(400);
  });

  it('refuses an anonymous caller with 401', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/creator/comments/bulk',
      payload: { ids: [ABSENT], action: { action: 'approve' } },
    });

    expect(res.statusCode).toBe(401);
  });
});

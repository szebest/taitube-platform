import { CHANNEL_HEADER, type RestrictionActionBody } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  AUTHOR,
  CREATOR,
  VIDEO,
  type CommentsApp,
  type Who,
  buildCommentsApp,
} from '../../__tests__/comments-app';

const SHADOW: RestrictionActionBody = { action: 'shadow_ban' };

describe('channel restrictions routes: what a shadow ban hides', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const url = (userId = AUTHOR) => `/v1/me/channel/restrictions/${userId}`;
  const as = (who: Who) => ({ ...AS[who], [CHANNEL_HEADER]: channelId });
  const put = (payload: RestrictionActionBody, who: Who = 'creator', userId = AUTHOR) =>
    ctx.app.inject({ method: 'PUT', url: url(userId), headers: as(who), payload });
  const lift = (who: Who = 'creator', userId = AUTHOR) =>
    ctx.app.inject({ method: 'DELETE', url: url(userId), headers: as(who) });
  const own = (who: Who) =>
    ctx.app.inject({
      method: 'GET',
      url: `/v1/channels/${channelId}/me/restriction`,
      headers: AS[who],
    });
  const publicList = async () => (await ctx.list()).json();
  const audited = async () =>
    expectOk(await ctx.repositories.channelAudit.list(channelId, { cursor: null, limit: 20 }))
      .map(({ action, actorUserId, targetId, meta }) => ({ action, actorUserId, targetId, meta }))
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

  describe('a shadow ban', () => {
    it('takes the comments of the user out of every public read and count, and lifting puts them back', async () => {
      await ctx.comment('author', 'mine');
      await ctx.comment('stranger', 'theirs');
      expect((await publicList()).total).toBe(2);

      const banned = await put(SHADOW);
      const during = await publicList();
      const own = (await ctx.list('', AS.author)).json();
      await lift();
      const after = await publicList();

      expect(banned.statusCode).toBe(200);
      expect(banned.json()).toMatchObject({ userId: AUTHOR, kind: 'shadow', reason: null });
      expect([during.items.length, during.total]).toEqual([1, 1]);
      expect(own.total).toBe(2);
      expect([after.items.length, after.total]).toEqual([2, 2]);
    });

    it('is never told to its user, who reads no ban', async () => {
      await put(SHADOW);

      const res = await own('author');

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.RESTRICTION_NOT_FOUND);
    });

    it('records the shadow ban and its lift in the channel audit log', async () => {
      await put(SHADOW);
      await lift();

      expect(await audited()).toEqual([
        { action: 'user.shadow_banned', actorUserId: CREATOR, targetId: AUTHOR, meta: {} },
        {
          action: 'user.restriction_lifted',
          actorUserId: CREATOR,
          targetId: AUTHOR,
          meta: { kind: 'shadow' },
        },
      ]);
    });
  });

  it('lists the comments of restricted users under the restricted filter of the inbox', async () => {
    const first = await ctx.comment('author', 'mine');
    await ctx.comment('stranger', 'theirs');
    const inbox = async () =>
      (
        await ctx.app.inject({
          method: 'GET',
          url: '/v1/creator/comments?filter=restricted',
          headers: AS.creator,
        })
      )
        .json()
        .items.map((item: { id: string }) => item.id);

    const before = await inbox();
    await put({ action: 'ban' });
    const during = await inbox();
    await lift();

    expect([before, during, await inbox()]).toEqual([[], [first], []]);
  });

  it('keeps the video the comments are on in view of the restriction it purges', async () => {
    await ctx.comment('author', 'mine');
    await publicList();

    await put(SHADOW);

    expect((await ctx.list('', {}, VIDEO)).json().items).toEqual([]);
  });
});

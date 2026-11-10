import { CHANNEL_HEADER, type RestrictionActionBody } from '@vp/api-contracts';
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

const HOUR_MS = 3_600_000;
const SHADOW: RestrictionActionBody = { action: 'shadow_ban' };

describe('channel restrictions routes', () => {
  let ctx: CommentsApp;
  let channelId: string;

  const url = (userId = AUTHOR) => `/v1/me/channel/restrictions/${userId}`;
  const as = (who: Who) => ({ ...AS[who], [CHANNEL_HEADER]: channelId });
  const put = (payload: RestrictionActionBody, who: Who = 'creator', userId = AUTHOR) =>
    ctx.app.inject({ method: 'PUT', url: url(userId), headers: as(who), payload });
  const lift = (who: Who = 'creator', userId = AUTHOR) =>
    ctx.app.inject({ method: 'DELETE', url: url(userId), headers: as(who) });
  const list = (who: Who = 'creator', query = '') =>
    ctx.app.inject({ method: 'GET', url: `/v1/me/channel/restrictions${query}`, headers: as(who) });
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

  describe('who may restrict', () => {
    it.each<{ role: ChannelRole | 'owner'; status: number }>([
      { role: 'owner', status: 200 },
      { role: 'manager', status: 200 },
      { role: 'moderator', status: 200 },
      { role: 'editor', status: 403 },
      { role: 'analytics', status: 403 },
    ])(
      'answers a $role listing, restricting and lifting with $status',
      async ({ role, status }) => {
        const who: Who = role === 'owner' ? 'creator' : 'stranger';
        if (role !== 'owner') {
          await seedTeamMember(ctx.repositories, { ownerId: CREATOR, memberId: STRANGER, role });
        }

        const read = await list(who);
        const write = await put(SHADOW, who);
        const undo = await lift(who);

        expect([read.statusCode, write.statusCode, undo.statusCode]).toEqual([
          status,
          status,
          status === 200 ? 204 : status,
        ]);
      }
    );

    it('refuses an anonymous caller with 401 and a caller of another channel with 403', async () => {
      const anonymous = await ctx.app.inject({ method: 'GET', url: '/v1/me/channel/restrictions' });
      const stranger = await put(SHADOW, 'stranger');

      expect([anonymous.statusCode, stranger.statusCode]).toEqual([401, 403]);
    });

    it.each([
      { scenario: 'the owner', target: CREATOR },
      { scenario: 'a member', target: STRANGER },
    ])('refuses to restrict $scenario with 409', async ({ target }) => {
      await seedTeamMember(ctx.repositories, {
        ownerId: CREATOR,
        memberId: STRANGER,
        role: 'moderator',
      });

      const res = await put(SHADOW, 'creator', target);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe(ErrorCodes.CANNOT_RESTRICT_MEMBER);
    });
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

  describe('a ban', () => {
    const endsInAnHour = () => new Date(Date.now() + HOUR_MS).toISOString();

    it('refuses the comments of the user with the reason and the end, and says so to them', async () => {
      const expiresAt = endsInAnHour();
      const banned = await put({ action: 'ban', reason: ' spam ', expiresAt });

      const refused = await ctx.post('author', { content: 'hi' });
      const told = await own('author');

      expect(banned.json()).toMatchObject({ kind: 'ban', reason: 'spam', expiresAt });
      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toMatchObject({
        code: ErrorCodes.COMMENTS_BANNED,
        errors: [{ reason: 'spam', expiresAt }],
      });
      expect(told.json()).toEqual({ reason: 'spam', expiresAt });
      expect((await own('stranger')).statusCode).toBe(404);
    });

    it.each([
      {
        scenario: 'a ban',
        body: { action: 'ban', reason: 'spam' } as RestrictionActionBody,
        status: 403,
      },
      { scenario: 'a shadow ban', body: SHADOW, status: 200 },
    ])(
      'refuses a reaction from a user with $scenario only for a ban: $status',
      async ({ body, status }) => {
        await put(body);

        const res = await ctx.app.inject({
          method: 'PUT',
          url: `/v1/videos/${VIDEO}/reactions`,
          headers: AS.author,
          payload: { type: 'LIKE' },
        });

        expect(res.statusCode).toBe(status);
        if (status === 403) {
          expect(res.json()).toMatchObject({
            code: ErrorCodes.COMMENTS_BANNED,
            errors: [{ reason: 'spam', expiresAt: null }],
          });
        }
      }
    );

    it('leaves what the user already wrote public, and the count alone', async () => {
      await ctx.comment('author', 'before');

      await put({ action: 'ban' });

      expect((await publicList()).total).toBe(1);
    });

    it('lets the user write again once it is lifted, and records the end it was given', async () => {
      const expiresAt = endsInAnHour();
      await put({ action: 'ban', expiresAt });
      await lift();

      expect((await ctx.post('author', { content: 'back' })).statusCode).toBe(201);
      expect((await audited())[0]).toMatchObject({ action: 'user.banned', meta: { expiresAt } });
    });

    it('is over at its end with no job having run', async () => {
      expectOk(
        await ctx.repositories.channelUserRestrictions.apply({
          channelId,
          userId: AUTHOR,
          kind: 'ban',
          reason: 'spam',
          expiresAt: new Date(Date.now() - HOUR_MS),
          createdBy: CREATOR,
        })
      );

      expect((await ctx.post('author', { content: 'hi' })).statusCode).toBe(201);
      expect((await own('author')).statusCode).toBe(404);
      expect((await list()).json().items).toEqual([]);
    });

    it.each([
      {
        scenario: 'an end in the past',
        body: { action: 'ban', expiresAt: '2020-01-01T00:00:00.000Z' },
        status: 422,
      },
      {
        scenario: 'a reason over 200 characters',
        body: { action: 'ban', reason: 'x'.repeat(201) },
        status: 400,
      },
      { scenario: 'an action that is no restriction', body: { action: 'lift' }, status: 400 },
    ])('refuses $scenario with $status', async ({ body, status }) => {
      const res = await put(body as RestrictionActionBody);

      expect(res.statusCode).toBe(status);
    });
  });

  describe('the list and the lift', () => {
    it('lists the restricted users newest first with their kind, reason, end and channel', async () => {
      await ctx.repositories.users.upsert({ id: STRANGER, email: 's@example.com', tier: 'free' });
      await put(SHADOW);
      await put({ action: 'ban', reason: 'spam' }, 'creator', STRANGER);

      const res = await list('creator', '?limit=1');
      const next = await list('creator', `?limit=1&cursor=${res.json().nextCursor}`);

      expect(res.json().items).toMatchObject([{ userId: STRANGER, kind: 'ban', reason: 'spam' }]);
      expect(next.json().items).toMatchObject([
        { userId: AUTHOR, kind: 'shadow', user: { handle: 'author' } },
      ]);
      expect(next.json().nextCursor).toBeNull();
    });

    it('answers 404 for lifting what is not there, and 422 for restricting a user who does not exist', async () => {
      const lifted = await lift();
      const missing = await put(SHADOW, 'creator', '99999999-9999-7999-8999-999999999999');

      expect(lifted.statusCode).toBe(404);
      expect(lifted.json().code).toBe(ErrorCodes.RESTRICTION_NOT_FOUND);
      expect(missing.statusCode).toBe(422);
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

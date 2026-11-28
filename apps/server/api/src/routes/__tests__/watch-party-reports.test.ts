import { expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  type RoomApp,
} from '../../__tests__/watch-party-room-app';

const ROOM = `/v1/watch-parties/${ROOM_ID}`;
const SOON = new Date(Date.now() + 60 * 60_000);

describe('watch party interest, reports and the moderator close', () => {
  let ctx: RoomApp;
  let owner: Account;
  let member: Account;

  beforeEach(async () => {
    ctx = await buildRoomApp();
    ({ owner, member } = ctx);
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const room = async () => expectOk(await ctx.repositories.watchPartyRooms.findById(ROOM_ID));
  const schedule = async () => {
    const current = await room();
    expectOk(
      await ctx.repositories.watchPartyRooms.updateSettings(
        ROOM_ID,
        { scheduledFor: SOON },
        current?.version ?? 0,
        null,
        new Date()
      )
    );
  };
  const report = (who: Account | null, body: Record<string, unknown> = { reason: 'spam' }) =>
    ctx.call(who, 'POST', `${ROOM}/reports`, body);

  describe('interest', () => {
    it('lists a scheduled room under interested until the account withdraws', async () => {
      await schedule();
      const viewer = await ctx.account(3);

      expect((await ctx.call(viewer, 'PUT', `${ROOM}/interest`)).statusCode).toBe(204);
      const mine = (await ctx.call(viewer, 'GET', '/v1/me/watch-parties')).json();
      expect(mine.interested.map(({ id }: { id: string }) => id)).toEqual([ROOM_ID]);

      expect((await ctx.call(viewer, 'DELETE', `${ROOM}/interest`)).statusCode).toBe(204);
      expect((await ctx.call(viewer, 'GET', '/v1/me/watch-parties')).json().interested).toEqual([]);
    });

    it.each([
      {
        scenario: 'a room with no schedule',
        who: 'viewer',
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      { scenario: 'signed out', who: 'nobody', status: 401, code: ErrorCodes.UNAUTHORIZED },
    ])('refuses interest from $scenario', async ({ who, status, code }) => {
      await schedule();
      if (who === 'viewer') {
        const current = await room();
        expectOk(
          await ctx.repositories.watchPartyRooms.updateSettings(
            ROOM_ID,
            { scheduledFor: null },
            current?.version ?? 0,
            null,
            new Date()
          )
        );
      }
      const res = await ctx.call(
        who === 'viewer' ? await ctx.account(3) : null,
        'PUT',
        `${ROOM}/interest`
      );

      expect([res.statusCode, res.json().code]).toEqual([status, code]);
    });

    it('answers 404 for a private room the account cannot see', async () => {
      await schedule();
      await ctx.roomIs('private');

      expect((await ctx.call(await ctx.account(3), 'PUT', `${ROOM}/interest`)).statusCode).toBe(
        404
      );
    });
  });

  describe('reports', () => {
    it('takes one report per account and answers a second with 409', async () => {
      await ctx.roomIs('public');
      const viewer = await ctx.account(3);

      expect((await report(viewer)).statusCode).toBe(201);
      const again = await report(viewer);

      expect([again.statusCode, again.json().code]).toEqual([
        409,
        ErrorCodes.WATCH_PARTY_ALREADY_REPORTED,
      ]);
    });

    it('hides the room from discovery once three accounts have reported it', async () => {
      await ctx.roomIs('public');
      for (const n of [3, 4, 5]) await report(await ctx.account(n));

      expect((await room())?.hiddenAt).not.toBeNull();
    });

    it.each([
      { scenario: 'signed out', visibility: 'public' as const, status: 401 },
      {
        scenario: 'an unlisted room they are not in',
        visibility: 'unlisted' as const,
        status: 403,
      },
      { scenario: 'a private room they are not in', visibility: 'private' as const, status: 404 },
    ])('refuses a report on $scenario with $status', async ({ scenario, visibility, status }) => {
      await ctx.roomIs(visibility);

      const res = await report(scenario === 'signed out' ? null : await ctx.account(3));

      expect(res.statusCode).toBe(status);
    });

    it('lets a member of an unlisted room report one of its members', async () => {
      await ctx.roomIs('unlisted');

      const res = await report(member, { targetKey: owner.key, context: 'chat', reason: 'abuse' });

      expect(res.statusCode).toBe(201);
    });
  });

  describe('the moderator close and restore', () => {
    it.each([
      { who: 'a plain member', status: 403 },
      { who: 'a moderator', status: 200 },
    ])('$who closing a room answers $status', async ({ who, status }) => {
      const caller = who === 'a moderator' ? await ctx.account(6, 'MODERATOR') : member;

      const res = await ctx.call(caller, 'POST', `/v1/admin/watch-parties/${ROOM_ID}/close`, {
        reason: 'abuse',
      });

      expect(res.statusCode).toBe(status);
      expect((await room())?.closedReason).toBe(status === 200 ? 'moderator' : null);
    });

    it('lifts the hide and resolves the reports when a moderator restores the room', async () => {
      await ctx.roomIs('public');
      for (const n of [3, 4, 5]) await report(await ctx.account(n));
      const moderator = await ctx.account(6, 'MODERATOR');

      const res = await ctx.call(moderator, 'POST', `/v1/admin/watch-parties/${ROOM_ID}/restore`, {
        reason: 'fine',
      });

      expect(res.statusCode).toBe(200);
      expect((await room())?.hiddenAt).toBeNull();
    });
  });
});

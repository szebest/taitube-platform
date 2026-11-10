import { createHash } from 'node:crypto';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  type RoomApp,
} from '../../__tests__/watch-party-room-app';

const JOIN = `/v1/watch-parties/${ROOM_ID}/join`;
const LINKS = `/v1/watch-parties/${ROOM_ID}/invite-links`;

describe('joining a watch party by an invite link', () => {
  let ctx: RoomApp;
  let owner: Account;
  let joiner: Account;

  beforeEach(async () => {
    ctx = await buildRoomApp();
    owner = ctx.owner;
    joiner = await ctx.account(3);
    await ctx.roomIs('private');
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const makeLink = async (payload: Record<string, unknown> = {}) =>
    (await ctx.call(owner, 'POST', LINKS, payload)).json() as { id: string; token: string };
  const join = (who: Account, invite: string) => ctx.call(who, 'POST', JOIN, { invite });
  const seatedKeys = async () =>
    expectOk(await ctx.repositories.watchPartyMembers.listSeated(ROOM_ID)).map(
      ({ memberKey }) => memberKey
    );

  it('seats the holder of a live link, privately, through that link', async () => {
    const { token } = await makeLink();

    const res = await join(joiner, token);

    expect(res.statusCode).toBe(200);
    expect(res.json().membership).toMatchObject({
      memberKey: joiner.key,
      joinedVia: 'invite_link',
    });
    expect(await seatedKeys()).toContain(joiner.key);
  });

  it.each([
    {
      scenario: 'revoked',
      token: async () => {
        const { id, token } = await makeLink();
        await ctx.call(owner, 'DELETE', `${LINKS}/${id}`);
        return token;
      },
    },
    {
      scenario: 'expired',
      token: async () => {
        const token = 'expired-token';
        expectOk(
          await ctx.repositories.watchPartyInviteLinks.create({
            id: uuidv7(),
            roomId: ROOM_ID,
            createdBy: owner.key,
            tokenHash: createHash('sha256').update(token).digest('hex'),
            expiresAt: new Date(Date.now() - 1000),
            maxUses: null,
            uses: 0,
            revokedAt: null,
            createdAt: new Date(Date.now() - 3_600_000),
          })
        );
        return token;
      },
    },
    {
      scenario: 'spent',
      token: async () => {
        const { token } = await makeLink({ maxUses: 1 });
        await join(await ctx.account(4), token);
        return token;
      },
    },
    { scenario: 'unknown', token: async () => 'never-issued' },
  ])('joins nobody through a $scenario link and removes no member', async ({ token }) => {
    const presented = await token();
    const before = await seatedKeys();

    const res = await join(joiner, presented);

    expect([res.statusCode, res.json().code]).toEqual([403, ErrorCodes.WATCH_PARTY_INVITE_INVALID]);
    expect(await seatedKeys()).toEqual(before);
    expect(before).toEqual(expect.arrayContaining([owner.key, ctx.member.key]));
  });
});

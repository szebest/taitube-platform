import { lobbyPlayback } from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { joinRoom } from '../watch-party-join';
import { WatchPartyService } from '../watch-party-service';
import {
  assignRole,
  banKey,
  GUEST_ID,
  guestSession,
  OWNER_KEY,
} from './watch-party-access-fixture';
import {
  type PartyBodyOverrides,
  ANONYMOUS,
  discordSession,
  guestCaller,
  MEMBER,
  OTHER,
  OWNER,
  seedParty,
  startParty,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUpService(body: PartyBodyOverrides = {}) {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const room = await startParty(test, body);
  const service = new WatchPartyService(test.deps);
  const seat = (caller = userCaller(MEMBER)) =>
    joinRoom(test.deps, room.id, caller, undefined).then(expectOk);
  return { ...test, room, service, seat };
}

describe('apps/server/api/services: WatchPartyService.get', () => {
  it('previews the room to anyone', async () => {
    const { service, room } = await setUpService();

    expect(expectOk(await service.get(room.id, ANONYMOUS, undefined))).toMatchObject({
      id: room.id,
      viewer: { canJoin: 'yes' },
    });
  });

  it('does not know a room that is not there', async () => {
    const { service } = await setUpService();

    const result = await service.get('018f0000-0000-7000-8000-0000000000ff', ANONYMOUS, undefined);

    expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });
});

describe('apps/server/api/services: WatchPartyService.roster', () => {
  async function crowded() {
    const world = await setUpService();
    await world.seat(userCaller(MEMBER));
    await world.seat(guestCaller(guestSession()));
    await world.seat(guestCaller(discordSession()));
    return world;
  }

  it('lists every seat to a member, named, with roles, in the lobby', async () => {
    const world = await crowded();
    await assignRole(world, world.room.id, `user:${MEMBER.id}`, 'vip');

    const roster = expectOk(await world.service.roster(world.room.id, userCaller(MEMBER)));

    expect(roster).toMatchObject({ view: 'members', guests: 1 });
    expect(roster).toHaveProperty('entries.length', 3);
    expect(roster).toMatchObject({
      entries: expect.arrayContaining([
        {
          memberKey: `user:${MEMBER.id}`,
          kind: 'user',
          source: 'app',
          name: 'Max Member',
          avatarUrl: null,
          roleIds: [expect.any(String)],
          ready: false,
          sync: 'lobby',
          voice: 'off',
          away: false,
        },
        expect.objectContaining({ memberKey: OWNER_KEY, name: 'Olivia Owner', roleIds: [] }),
        expect.objectContaining({ kind: 'discord', name: 'Discord Dana' }),
      ]),
    });
  });

  it('lists the guests one by one to someone who may remove them', async () => {
    const world = await crowded();

    const roster = expectOk(await world.service.roster(world.room.id, userCaller(OWNER)));

    expect(roster).toMatchObject({ view: 'members', guests: 0 });
    expect(roster).toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({
          memberKey: `guest:${GUEST_ID}`,
          name: 'Guest 1000',
          kind: 'guest',
        }),
      ]),
    });
  });

  it('puts everyone in sync once the room is no longer in the lobby', async () => {
    const world = await setUpService();
    expectOk(
      await world.repositories.watchPartyRooms.commitPlayback(world.room.id, {
        expected: { playbackVersion: 0, rolesVersion: 0 },
        playback: { ...lobbyPlayback(null), phase: 'playing', anchorAt: world.clock.nowMs },
        line: null,
        at: world.deps.now(),
      })
    );

    const roster = expectOk(await world.service.roster(world.room.id, userCaller(OWNER)));

    expect(roster).toMatchObject({ entries: [expect.objectContaining({ sync: 'in_sync' })] });
  });

  it('shows anyone else who may read the room its preview', async () => {
    const world = await setUpService();

    expect(expectOk(await world.service.roster(world.room.id, userCaller(OTHER)))).toMatchObject({
      view: 'preview',
      preview: { total: 0 },
    });
  });

  it('does not know a private room to a stranger', async () => {
    const world = await setUpService({ visibility: 'private' });

    expect(expectErr(await world.service.roster(world.room.id, userCaller(OTHER))).code).toBe(
      ErrorCodes.WATCH_PARTY_NOT_FOUND
    );
  });
});

describe('apps/server/api/services: WatchPartyService.listMine', () => {
  it('lists the open rooms the caller owns and the others they sit in', async () => {
    const world = await setUpService();
    const second = await startParty(world, {}, OTHER);
    await world.seat(userCaller(OTHER));
    expectOk(await world.repositories.watchPartyRooms.close(second.id, 'owner', null, new Date()));
    const closed = await startParty(world);
    expectOk(await world.repositories.watchPartyRooms.close(closed.id, 'owner', null, new Date()));

    const mine = expectOk(await world.service.listMine(userCaller(OWNER)));
    const theirs = expectOk(await world.service.listMine(userCaller(OTHER)));

    expect(mine.owning.map(({ id }) => id)).toEqual([world.room.id]);
    expect(mine.joined).toEqual([]);
    expect(theirs.owning).toEqual([]);
    expect(theirs.joined.map(({ id }) => id)).toEqual([world.room.id]);
    expect(theirs.interested).toEqual([]);
  });

  it('refuses a signed-out caller', async () => {
    const { service } = await setUpService();

    expect(expectErr(await service.listMine(ANONYMOUS)).code).toBe(ErrorCodes.UNAUTHORIZED);
  });
});

describe('apps/server/api/services: WatchPartyService.socketTicket', () => {
  it.each([
    { scenario: 'an account', as: userCaller(OWNER), role: 'USER' },
    { scenario: 'a plain member', as: userCaller(MEMBER), role: 'USER' },
  ])('hands $scenario a one-time socket token good for thirty seconds', async ({ as, role }) => {
    const world = await setUpService();
    await world.seat(as);

    const issued = expectOk(await world.service.socketTicket(world.room.id, as));

    expect(issued.expiresAt).toBe(new Date(world.clock.nowMs + 30 * MS_PER_SECOND).toISOString());
    const redeemed = expectOk(await world.gate.redeemTicket(issued.ticket));
    expect(redeemed).toMatchObject({ roomId: world.room.id, role, principal: { kind: 'user' } });
    expect(expectOk(await world.gate.redeemTicket(issued.ticket))).toBeNull();
  });

  it('hands a guest a socket token with no platform role', async () => {
    const world = await setUpService();
    const caller = guestCaller(guestSession());
    await world.seat(caller);

    const issued = expectOk(await world.service.socketTicket(world.room.id, caller));

    expect(expectOk(await world.gate.redeemTicket(issued.ticket))).toMatchObject({
      role: null,
      principal: { kind: 'guest', guestId: GUEST_ID },
    });
  });

  it('lets the owner in who has left their own seat', async () => {
    const world = await setUpService();
    expectOk(
      await world.repositories.watchPartyMembers.leave(world.room.id, OWNER_KEY, null, new Date())
    );

    expectOk(await world.service.socketTicket(world.room.id, userCaller(OWNER)));
  });

  it.each([
    { scenario: 'a signed-out caller', as: ANONYMOUS, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a stranger', as: userCaller(OTHER), code: ErrorCodes.WATCH_PARTY_NOT_FOUND },
    {
      scenario: 'a member of a closed room',
      as: userCaller(MEMBER),
      seated: true,
      closed: true,
      code: ErrorCodes.WATCH_PARTY_CLOSED,
    },
    {
      scenario: 'a banned account',
      as: userCaller(MEMBER),
      seated: true,
      banned: true,
      code: ErrorCodes.WATCH_PARTY_BANNED,
    },
  ])('refuses $scenario with $code', async ({ as, seated, closed, banned, code }) => {
    const world = await setUpService();
    if (seated) await world.seat(as);
    if (banned) await banKey(world, world.room.id, `user:${MEMBER.id}`);
    if (closed) {
      expectOk(
        await world.repositories.watchPartyRooms.close(world.room.id, 'owner', null, new Date())
      );
    }

    expect(expectErr(await world.service.socketTicket(world.room.id, as)).code).toBe(code);
  });
});

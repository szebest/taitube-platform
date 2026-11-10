import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { memberKeyOf } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { WatchPartySocketService } from '../watch-party-socket-service';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { ORIGIN, socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OTHER, OWNER } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

async function issue(party: Party, user: UserContext, roomId = ROOM_ID) {
  const ticket = `ticket-${user.id}-${roomId}`;
  expectOk(
    await party.gate.issueTicket(
      ticket,
      { roomId, principal: { kind: 'user', userId: user.id }, role: user.role },
      30
    )
  );
  return ticket;
}

async function setUp(options: Parameters<typeof socketRoom>[0] = {}) {
  const party = await socketRoom(options);
  return { party, service: new WatchPartySocketService(party.socketDeps) };
}

describe('WatchPartySocketService', () => {
  it('admits a member holding a one-time token to the room’s presence', async () => {
    const { party, service } = await setUp();
    const ticket = await issue(party, MEMBER);

    const session = expectOk(await service.open({ roomId: ROOM_ID, ticket, origin: ORIGIN }));

    expect(session).toMatchObject({ memberKey: keyOf(MEMBER), kind: 'user' });
    const present = expectOk(await party.presence.members(ROOM_ID, 0));
    expect(present.map(({ memberKey }) => memberKey)).toEqual([keyOf(MEMBER)]);
  });

  it.each([
    {
      scenario: 'no token',
      ticket: undefined,
      origin: ORIGIN,
      code: ErrorCodes.WATCH_PARTY_TICKET_INVALID,
    },
    {
      scenario: 'a spent token',
      ticket: 'spent',
      origin: ORIGIN,
      code: ErrorCodes.WATCH_PARTY_TICKET_INVALID,
    },
    {
      scenario: 'a foreign origin',
      ticket: 'spent',
      origin: 'https://evil.test',
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario before the upgrade', async ({ ticket, origin, code }) => {
    const { service } = await setUp();

    const refused = await service.open({ roomId: ROOM_ID, ticket, origin });

    expect(expectErr(refused).code).toBe(code);
  });

  it('refuses a token used twice', async () => {
    const { party, service } = await setUp();
    const ticket = await issue(party, MEMBER);
    expectOk(await service.open({ roomId: ROOM_ID, ticket }));

    expect(expectErr(await service.open({ roomId: ROOM_ID, ticket })).code).toBe(
      ErrorCodes.WATCH_PARTY_TICKET_INVALID
    );
  });

  it('refuses a stranger and a banned member', async () => {
    const { party, service } = await setUp();
    const at = party.deps.now();
    expectOk(
      await party.repositories.watchPartyMembers.ban(
        {
          roomId: ROOM_ID,
          memberKey: keyOf(MEMBER),
          ipHash: null,
          bannedBy: keyOf(OWNER),
          reason: null,
          createdAt: at,
        },
        {
          id: party.deps.secrets.newId(),
          line: { event: 'banned', actorKey: null, targetKey: keyOf(MEMBER), detail: null },
          videoId: null,
          positionMs: null,
          createdAt: at,
        }
      )
    );

    const stranger = await service.open({ roomId: ROOM_ID, ticket: await issue(party, OTHER) });
    const banned = await service.open({ roomId: ROOM_ID, ticket: await issue(party, MEMBER) });

    expect(expectErr(stranger).code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
    expect(expectErr(banned).code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
  });

  it('refuses a full room but admits its owner above the limit', async () => {
    const { party, service } = await setUp({ config: { watchParties: { maxMembers: 2 } } });
    const nowMs = party.deps.now().getTime();
    for (const key of ['user:a', 'user:b']) {
      expectOk(await party.presence.admit(ROOM_ID, key, { limit: null, nowMs, staleBeforeMs: 0 }));
    }

    const member = await service.open({ roomId: ROOM_ID, ticket: await issue(party, MEMBER) });
    const owner = await service.open({ roomId: ROOM_ID, ticket: await issue(party, OWNER) });

    expect(expectErr(member)).toMatchObject({ code: ErrorCodes.WATCH_PARTY_FULL, present: 2 });
    expect(expectOk(owner).memberKey).toBe(memberKeyOf({ kind: 'user', userId: OWNER.id }));
  });

  it('sends the snapshot first, then the backlog, then what is published live', async () => {
    const { party, service } = await setUp();
    const session = expectOk(
      await service.open({ roomId: ROOM_ID, ticket: await issue(party, MEMBER) })
    );
    const sent: WatchPartyServerFrame[] = [];

    expectOk(
      await service.connect(session, null, { send: (frame) => sent.push(frame), end: () => {} })
    );
    expectOk(await party.deps.broadcaster.toRoom(ROOM_ID, { type: 'countdown', startsAt: 1 }));

    expect(sent[0]?.type).toBe('hello');
    expect(sent.at(-1)).toEqual({ type: 'countdown', startsAt: 1 });
    expect(sent.filter(({ type }) => type === 'hello')).toHaveLength(1);
  });
});

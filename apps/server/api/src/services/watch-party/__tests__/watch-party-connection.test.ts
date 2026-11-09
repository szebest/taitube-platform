import type { WatchPartyServerFrame } from '@vp/api-contracts';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import type { RoomEnvelope } from '../watch-party-broadcaster';
import { WatchPartySocketService } from '../watch-party-socket-service';
import { GUEST_KEY, keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { drainMicrotasks, socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OWNER } from './watch-party-test-deps';

const EVERYONE = { memberKey: null, audience: null, except: null } as const;
const COUNTDOWN: WatchPartyServerFrame = { type: 'countdown', startsAt: 1 };

async function connected(user: UserContext = MEMBER) {
  const party = await socketRoom();
  const service = new WatchPartySocketService(party.socketDeps);
  expectOk(
    await party.gate.issueTicket(
      'ticket',
      { roomId: ROOM_ID, principal: { kind: 'user', userId: user.id }, role: user.role },
      30
    )
  );
  const session = expectOk(await service.open({ roomId: ROOM_ID, ticket: 'ticket' }));
  const sent: WatchPartyServerFrame[] = [];
  const ended = vi.fn();
  const connection = expectOk(
    await service.connect(session, null, { send: (frame) => sent.push(frame), end: ended })
  );
  sent.length = 0;
  return { party, connection, sent, ended };
}

describe('RoomConnection', () => {
  it.each([
    { scenario: 'a frame for the room', envelope: { ...EVERYONE }, heard: true },
    {
      scenario: 'a frame for this member',
      envelope: { ...EVERYONE, memberKey: keyOf(MEMBER) },
      heard: true,
    },
    {
      scenario: 'a frame for another member',
      envelope: { ...EVERYONE, memberKey: keyOf(OWNER) },
      heard: false,
    },
    {
      scenario: 'a frame for holders of a permission it holds',
      envelope: { ...EVERYONE, audience: 'playback.control' as const },
      heard: true,
    },
    {
      scenario: 'a frame for holders of one it lacks',
      envelope: { ...EVERYONE, audience: 'roles.manage' as const },
      heard: false,
    },
  ])('hears $scenario: $heard', async ({ envelope, heard }) => {
    const { connection, sent } = await connected();

    connection.deliver({ ...envelope, frame: COUNTDOWN } as RoomEnvelope);

    expect(sent).toEqual(heard ? [COUNTDOWN] : []);
  });

  it.each(['kicked', 'superseded'] as const)('closes the socket after %s', async (type) => {
    const { connection, sent, ended } = await connected();

    connection.deliver({ ...EVERYONE, memberKey: keyOf(MEMBER), frame: { type } });

    expect(sent).toEqual([{ type }]);
    expect(ended).toHaveBeenCalledOnce();
  });

  it('hides each guest from a member who may not remove them', async () => {
    const { connection, sent } = await connected();
    const guest = {
      memberKey: GUEST_KEY,
      kind: 'guest' as const,
      source: 'app' as const,
      name: 'Guest 4821',
      avatarUrl: null,
      roleIds: [],
      ready: false,
      sync: 'in_sync' as const,
      voice: 'off' as const,
      away: false,
    };

    connection.deliver({
      ...EVERYONE,
      frame: { type: 'roster.patch', upserts: [guest], removals: [], guests: 1 },
    });

    expect(sent).toEqual([{ type: 'roster.patch', upserts: [], removals: [], guests: 1 }]);
  });

  it('carries on as the account after a seat upgrade, hearing frames for its new key', async () => {
    const { connection, sent } = await connected();
    const account = 'user:00000000-0000-7000-8000-00000000f0aa';

    connection.deliver({
      ...EVERYONE,
      memberKey: keyOf(MEMBER),
      frame: { type: 'you', memberKey: account, kind: 'user', roleIds: [] },
    });
    connection.deliver({ ...EVERYONE, memberKey: account, frame: COUNTDOWN });

    expect(sent.map(({ type }) => type)).toEqual(['you', 'countdown']);
  });

  it('starts the owner’s grace and frees the spot when the owner’s socket closes', async () => {
    const { party, connection } = await connected(OWNER);
    const begin = vi.spyOn(party.socketDeps.ownerGrace, 'begin');

    connection.leave();
    await drainMicrotasks();

    expect(expectOk(await party.presence.members(ROOM_ID, 0))).toEqual([]);
    expect(begin).toHaveBeenCalledWith(ROOM_ID);
  });

  it('keeps the spot for the newer socket when a superseded one closes', async () => {
    const { party, connection } = await connected();

    connection.deliver({ ...EVERYONE, memberKey: keyOf(MEMBER), frame: { type: 'superseded' } });
    connection.leave();

    const present = expectOk(await party.presence.members(ROOM_ID, 0));
    expect(present.map(({ memberKey }) => memberKey)).toEqual([keyOf(MEMBER)]);
  });

  it('answers a frame it cannot read with a validation failure', async () => {
    const { connection } = await connected();

    const reply = await connection.receive('not json');

    expect(reply.result.ok).toBe(false);
  });
});

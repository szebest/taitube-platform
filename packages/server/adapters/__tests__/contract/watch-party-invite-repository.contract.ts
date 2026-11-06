import type { NewOutboxInput } from '@vp/core/repositories';
import type { WatchPartyInvite } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  accountId,
  AT,
  createRoom,
  numberedId,
  OTHER_ROOM_ID,
  ROOM_ID,
  seedRoomWorld,
} from './watch-party-activity-fixtures';

const HOUR_MS = 3_600_000;
const inviteId = (n: number) => numberedId(10, n);
const notifyId = (n: number) => numberedId(11, n);
const later = (ms: number) => new Date(AT.getTime() + ms);

function invite(n: number, overrides: Partial<WatchPartyInvite> = {}): WatchPartyInvite {
  return {
    id: inviteId(n),
    roomId: ROOM_ID,
    inviterId: OWNER_ID,
    inviteeId: accountId(n),
    status: 'pending',
    watching: { names: ['Ana'], count: 1 },
    expiresAt: later(HOUR_MS),
    createdAt: AT,
    ...overrides,
  };
}

const notification = (n: number): NewOutboxInput => ({
  id: notifyId(n),
  kind: 'watch_party_invite',
  payload: { type: 'pubsub', channel: 'invites', message: `invite ${n}` },
});

const idsOf = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

export function describeWatchPartyInviteRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyInviteRepository contract', () => {
    let subject: RepositoriesSubject;

    const invites = () => subject.repositories.watchPartyInvites;
    const create = async (n: number, overrides: Partial<WatchPartyInvite> = {}) =>
      expectOk(await invites().create(invite(n, overrides), notification(n)));
    const notified = async (n: number) =>
      expectOk(await subject.repositories.outbox.findById(notifyId(n))) !== null;
    const stored = async (n: number) => expectOk(await invites().findById(inviteId(n)));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedRoomWorld(subject);
    });

    it('sends a new invite and notifies the invitee once', async () => {
      const write = await create(3);

      expect(write).toEqual({ type: 'sent', invite: invite(3) });
      expect(await stored(3)).toEqual(invite(3));
      expect(await notified(3)).toBe(true);
    });

    it('renews a pending invite in place and sends no second notification', async () => {
      await create(3);
      const renewal = invite(3, {
        id: numberedId(10, 93),
        inviterId: OTHER_OWNER_ID,
        watching: { names: ['Ana', 'Tom'], count: 2 },
        expiresAt: later(2 * HOUR_MS),
        createdAt: later(HOUR_MS / 2),
      });

      const write = expectOk(await invites().create(renewal, notification(93)));

      const expected = { ...invite(3), ...renewal, id: inviteId(3), createdAt: AT };
      expect(write).toEqual({ type: 'folded', invite: expected });
      expect(await stored(3)).toEqual(expected);
      expect(await stored(93)).toBeNull();
      expect(await notified(93)).toBe(false);
    });

    it.each([
      {
        scenario: 'declined',
        settle: (n: number) => invites().decline(accountId(n), inviteId(n)),
      },
      { scenario: 'joined', settle: (n: number) => invites().markJoined(inviteId(n)) },
      { scenario: 'revoked', settle: (n: number) => invites().revoke(ROOM_ID, inviteId(n)) },
      { scenario: 'expired', settle: async () => undefined },
    ])('replaces a $scenario invite with a new one and notifies', async ({ settle }) => {
      await create(3);
      await settle(3);
      const second = invite(3, { id: numberedId(10, 93), createdAt: later(2 * HOUR_MS) });

      const write = expectOk(await invites().create(second, notification(93)));

      expect(write).toEqual({ type: 'sent', invite: second });
      expect(await stored(3)).toBeNull();
      expect(await stored(93)).toEqual(second);
      expect(await notified(93)).toBe(true);
    });

    it.each([
      { scenario: 'pending and unexpired', found: true },
      { scenario: 'expired', now: later(HOUR_MS), found: false },
      { scenario: 'for another invitee', invitee: 4, found: false },
      {
        scenario: 'declined',
        settle: () => invites().decline(accountId(3), inviteId(3)),
        found: false,
      },
      { scenario: 'revoked', settle: () => invites().revoke(ROOM_ID, inviteId(3)), found: false },
      { scenario: 'joined', settle: () => invites().markJoined(inviteId(3)), found: false },
    ])('finds a valid invite only when it is $scenario', async (row) => {
      await create(3);
      await row.settle?.();

      const valid = expectOk(
        await invites().findValid(ROOM_ID, accountId(row.invitee ?? 3), row.now ?? later(1))
      );

      expect(valid).toEqual(row.found ? invite(3) : null);
    });

    it('lists pending, declined and joined invites newest first, and counts the live pending ones', async () => {
      await create(3, { createdAt: later(1_000) });
      await create(4, { createdAt: later(2_000) });
      await create(5, { createdAt: later(3_000) });
      await create(6, { createdAt: later(4_000) });
      await create(7, { createdAt: later(5_000), expiresAt: later(4_500) });
      await invites().decline(accountId(4), inviteId(4));
      await invites().markJoined(inviteId(5));
      await invites().revoke(ROOM_ID, inviteId(6));

      expect(idsOf(expectOk(await invites().listForRoom(ROOM_ID)))).toEqual(
        [7, 5, 4, 3].map(inviteId)
      );
      expect(expectOk(await invites().countPending(ROOM_ID, later(6_000)))).toBe(1);
    });

    it('revokes a pending invite of the room once', async () => {
      await createRoom(subject, OTHER_ROOM_ID);
      await create(3);

      expect(expectOk(await invites().revoke(OTHER_ROOM_ID, inviteId(3)))).toBe(false);
      expect(expectOk(await invites().revoke(ROOM_ID, inviteId(3)))).toBe(true);
      expect(expectOk(await invites().revoke(ROOM_ID, inviteId(3)))).toBe(false);
      expect(await stored(3)).toMatchObject({ status: 'revoked' });
    });

    it.each([
      { scenario: 'the invitee', decliner: 3, declined: true },
      { scenario: 'someone else', decliner: 4, declined: false },
    ])('lets only the invitee decline: $scenario', async ({ decliner, declined }) => {
      await create(3);

      const result = expectOk(await invites().decline(accountId(decliner), inviteId(3)));

      expect(result).toEqual(declined ? { ...invite(3), status: 'declined' } : null);
      expect(await stored(3)).toMatchObject({ status: declined ? 'declined' : 'pending' });
    });

    it('declines a pending invite once', async () => {
      await create(3);
      await invites().decline(accountId(3), inviteId(3));

      expect(expectOk(await invites().decline(accountId(3), inviteId(3)))).toBeNull();
    });

    it('marks an invite joined', async () => {
      await create(3);

      expectOk(await invites().markJoined(inviteId(3)));

      expect(await stored(3)).toMatchObject({ status: 'joined' });
    });
  });
}

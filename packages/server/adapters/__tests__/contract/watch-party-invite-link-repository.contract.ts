import type { WatchPartyInviteLink } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  AT,
  createRoom,
  numberedId,
  OTHER_ROOM_ID,
  OWNER_KEY,
  ROOM_ID,
  seedRoomWorld,
} from './watch-party-activity-fixtures';

const HOUR_MS = 3_600_000;
const linkId = (n: number) => numberedId(12, n);
const later = (ms: number) => new Date(AT.getTime() + ms);

function link(n: number, overrides: Partial<WatchPartyInviteLink> = {}): WatchPartyInviteLink {
  return {
    id: linkId(n),
    roomId: ROOM_ID,
    createdBy: OWNER_KEY,
    tokenHash: `hash-${n}`,
    expiresAt: later(HOUR_MS),
    maxUses: null,
    uses: 0,
    revokedAt: null,
    createdAt: AT,
    ...overrides,
  };
}

const idsOf = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

export function describeWatchPartyInviteLinkRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyInviteLinkRepository contract', () => {
    let subject: RepositoriesSubject;

    const links = () => subject.repositories.watchPartyInviteLinks;
    const create = async (n: number, overrides: Partial<WatchPartyInviteLink> = {}) =>
      expectOk(await links().create(link(n, overrides)));
    const usesOf = async (n: number) => expectOk(await links().findByTokenHash(`hash-${n}`))?.uses;

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

    it('stores a link and finds it by its token hash', async () => {
      expect(await create(1, { maxUses: 5 })).toEqual(link(1, { maxUses: 5 }));

      expect(expectOk(await links().findByTokenHash('hash-1'))).toEqual(link(1, { maxUses: 5 }));
      expect(expectOk(await links().findByTokenHash('hash-9'))).toBeNull();
    });

    it.each([
      { scenario: 'an unlimited link', overrides: {}, counted: true },
      { scenario: 'a link under its limit', overrides: { maxUses: 2, uses: 1 }, counted: true },
      { scenario: 'a link at its limit', overrides: { maxUses: 2, uses: 2 }, counted: false },
      { scenario: 'a revoked link', overrides: { revokedAt: AT }, counted: false },
      { scenario: 'an expired link', overrides: { expiresAt: later(0) }, counted: false },
    ])('counts a use of $scenario only when it can still be used', async (row) => {
      await create(1, row.overrides);
      const before = await usesOf(1);

      expect(expectOk(await links().use(linkId(1), later(1)))).toBe(row.counted);
      expect(await usesOf(1)).toBe((before ?? 0) + (row.counted ? 1 : 0));
    });

    it('does not count a use of a link that is not there', async () => {
      expect(expectOk(await links().use(linkId(9), later(1)))).toBe(false);
    });

    it('counts exactly one of several concurrent uses of a single-use link', async () => {
      await create(1, { maxUses: 1 });

      const results = await Promise.all(
        Array.from({ length: 5 }, () => links().use(linkId(1), later(1)))
      );

      expect(results.map((result) => expectOk(result)).filter(Boolean)).toHaveLength(1);
      expect(await usesOf(1)).toBe(1);
    });

    it("lists one room's links newest first", async () => {
      await createRoom(subject, OTHER_ROOM_ID);
      await create(1, { createdAt: later(1_000) });
      await create(2, { createdAt: later(3_000) });
      await create(3, { createdAt: later(2_000) });
      await create(4, { roomId: OTHER_ROOM_ID, createdAt: later(4_000) });

      expect(idsOf(expectOk(await links().list(ROOM_ID)))).toEqual([2, 3, 1].map(linkId));
    });

    it('revokes a link of the room once and refuses further uses', async () => {
      await createRoom(subject, OTHER_ROOM_ID);
      await create(1);

      expect(expectOk(await links().revoke(OTHER_ROOM_ID, linkId(1), AT))).toBe(false);
      expect(expectOk(await links().revoke(ROOM_ID, linkId(1), AT))).toBe(true);
      expect(expectOk(await links().revoke(ROOM_ID, linkId(1), later(5)))).toBe(false);
      expect(expectOk(await links().findByTokenHash('hash-1'))?.revokedAt).toEqual(AT);
      expect(expectOk(await links().use(linkId(1), later(1)))).toBe(false);
    });
  });
}

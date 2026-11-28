import { expectOk } from '@kit/testing/result';
import {
  PENDING_ENFORCEMENT,
  WATCH_PARTY_PERMISSIONS,
  type WatchPartyPermission,
} from '@vp/domain';
import { assignRoleId, createRole } from './watch-party-access-fixture';
import { ENFORCEMENT, MISSING, type Party, POSITION } from './watch-party-enforcement-cases';
import { GUEST_KEY, keyOf, ROOM_ID, seatGuest } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { guestCaller, MEMBER, OTHER, OWNER, userCaller } from './watch-party-test-deps';

async function stripMember(party: Party): Promise<void> {
  const at = party.deps.now();
  expectOk(
    await party.repositories.watchPartyRoles.resetBuiltIns(
      ROOM_ID,
      [{ key: 'member', permissions: [] }],
      {
        at,
        line: {
          id: party.deps.secrets.newId(),
          line: { event: 'roles_changed', actorKey: keyOf(OWNER), targetKey: null, detail: null },
          videoId: null,
          positionMs: null,
          createdAt: at,
        },
      }
    )
  );
}

async function holding(party: Party, permissions: readonly WatchPartyPermission[]) {
  const role = await createRole(party, ROOM_ID, {
    name: `Holds ${permissions.join()}`,
    position: POSITION,
    permissions: [...permissions],
  });
  await assignRoleId(party, ROOM_ID, keyOf(MEMBER), role);
}

describe('each permission is enforced on the server', () => {
  it.each(WATCH_PARTY_PERMISSIONS.map(({ id }) => ({ id })))(
    '$id refuses a member without it and lets one with it through',
    async ({ id }) => {
      const enforcement = ENFORCEMENT[id];
      if (enforcement === undefined) {
        expect(PENDING_ENFORCEMENT).toContain(id);
        return;
      }
      expect(PENDING_ENFORCEMENT).not.toContain(id);
      const { alongside = [], before, attempt, refusal } = enforcement;

      const without = await socketRoom({ preset: 'public', members: [MEMBER, OTHER] });
      await stripMember(without);
      await holding(without, alongside);
      await before?.(without);
      const refused = await attempt(without, userCaller(MEMBER));

      const withIt = await socketRoom({ preset: 'public', members: [MEMBER, OTHER] });
      await stripMember(withIt);
      await holding(withIt, [...alongside, id]);
      await before?.(withIt);
      const allowed = await attempt(withIt, userCaller(MEMBER));

      expect(refused.ok).toBe(false);
      expect(refused.error).toMatchObject(refusal ?? { code: MISSING, permission: id });
      expect(allowed.error).toBeUndefined();
      expect(allowed.ok).toBe(true);
    }
  );
});

describe('a guest is refused every action on the server', () => {
  const guest = guestCaller({
    principal: { kind: 'guest', guestId: GUEST_KEY.slice('guest:'.length), name: 'Guest 4821' },
    ipHash: null,
  });
  const GUARDED = [
    'playback.control',
    'queue.add',
    'chat.post',
    'chat.react',
    'room.edit',
    'roles.assign',
  ] as const satisfies readonly WatchPartyPermission[];

  it.each(GUARDED.map((id) => ({ id })))(
    '$id, even with a role row inserted straight into the database',
    async ({ id }) => {
      const { before, attempt } = ENFORCEMENT[id] ?? { attempt: undefined };
      const party = await socketRoom({ preset: 'friends', members: [MEMBER, OTHER] });
      await seatGuest(party.repositories, party.deps.now());
      await assignRoleId(
        party,
        ROOM_ID,
        GUEST_KEY,
        await createRole(party, ROOM_ID, {
          name: 'Forged',
          position: POSITION,
          permissions: WATCH_PARTY_PERMISSIONS.map((entry) => entry.id),
        })
      );
      await before?.(party);

      const refused = await attempt?.(party, guest);

      expect(refused?.ok).toBe(false);
      expect(refused?.error).toMatchObject({ code: MISSING, permission: id });
    }
  );
});

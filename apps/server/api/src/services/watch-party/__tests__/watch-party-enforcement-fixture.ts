import { expectOk } from '@kit/testing/result';
import type { WatchPartyPermission } from '@vp/domain';
import { assignRoleId, createRole } from './watch-party-access-fixture';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import type { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OWNER } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

const POSITION = 450;

export async function stripMember(party: Party): Promise<void> {
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

export async function holding(party: Party, permissions: readonly WatchPartyPermission[]) {
  const role = await createRole(party, ROOM_ID, {
    name: `Holds ${permissions.join()}`,
    position: POSITION,
    permissions: [...permissions],
  });
  await assignRoleId(party, ROOM_ID, keyOf(MEMBER), role);
}

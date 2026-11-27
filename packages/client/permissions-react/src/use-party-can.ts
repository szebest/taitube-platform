import {
  canActOnMember,
  canInRoom,
  canTouchRole,
  type WatchPartyMemberAction,
  type WatchPartyMemberSubject,
  type WatchPartyRoleAction,
  type WatchPartyRoleSubject,
  type WatchPartyViewer,
} from '@vp/permissions';
import { usePartyAbility } from './party-permissions-provider';

export type PartyGate =
  | { kind: 'permission'; permission: WatchPartyViewer['permissions'][number] }
  | { kind: 'member'; action: WatchPartyMemberAction; member: WatchPartyMemberSubject }
  | { kind: 'role'; action: WatchPartyRoleAction; role: WatchPartyRoleSubject };

/** Whether the viewer may act in this room: a held permission, an act on a member, or on a role. */
export function usePartyCan(gate: PartyGate): boolean {
  const ability = usePartyAbility();

  switch (gate.kind) {
    case 'permission':
      return canInRoom(ability, gate.permission);
    case 'member':
      return canActOnMember(ability, gate.action, gate.member);
    case 'role':
      return canTouchRole(ability, gate.action, gate.role);
  }
}

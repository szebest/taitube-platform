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
  | { permission: WatchPartyViewer['permissions'][number] }
  | { action: WatchPartyMemberAction; member: WatchPartyMemberSubject }
  | { action: WatchPartyRoleAction; role: WatchPartyRoleSubject };

/** Whether the viewer may act in this room: a held permission, an act on a member, or on a role. */
export function usePartyCan(gate: PartyGate): boolean {
  const ability = usePartyAbility();

  if ('permission' in gate) {
    return canInRoom(ability, gate.permission);
  }
  if ('member' in gate) {
    return canActOnMember(ability, gate.action, gate.member);
  }
  return canTouchRole(ability, gate.action, gate.role);
}

import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import type { MemberKind, WatchPartyPermission, WatchPartyVisibility } from '@vp/domain';

/** A room as the principal-level ability sees it, for creating and reading one. */
export interface WatchPartyResource {
  readonly visibility?: WatchPartyVisibility;
  readonly isMember?: boolean;
  /** A valid per-recipient invite or invite link. */
  readonly hasGrant?: boolean;
}

/** The caller inside one room: what their roles give them, and where they sit. `kind` is `null` without a seat. */
export interface WatchPartyViewer {
  readonly permissions: readonly WatchPartyPermission[];
  readonly topPosition: number;
  readonly isOwner: boolean;
  readonly kind: MemberKind | null;
}

export interface WatchPartyRoleSubject {
  readonly key: string | null;
  readonly position: number;
}

export interface WatchPartyMemberSubject {
  readonly topPosition: number;
  readonly isOwner: boolean;
  readonly kind: MemberKind;
}

interface WatchPartyPermissionSubject {
  readonly id: WatchPartyPermission;
}

export type WatchPartyRoleAction = 'assign' | 'revoke' | 'create' | 'update' | 'delete' | 'move';
export type WatchPartyMemberAction = 'kick' | 'ban' | 'mute' | 'assign';

type WatchPartyAction =
  | WatchPartyPermission
  | WatchPartyRoleAction
  | WatchPartyMemberAction
  | 'grant';

type WatchPartySubjects =
  | InferSubjects<
      | (WatchPartyRoleSubject & ForcedSubject<'WatchPartyRole'>)
      | (WatchPartyMemberSubject & ForcedSubject<'WatchPartyMember'>)
      | (WatchPartyPermissionSubject & ForcedSubject<'WatchPartyPermission'>)
    >
  | 'WatchParty'
  | 'WatchPartyRole'
  | 'WatchPartyMember'
  | 'WatchPartyPermission';

/** Room-scoped: built per member per room from their roles, beside the principal-level `AppAbility`. */
export type WatchPartyAbility = MongoAbility<[WatchPartyAction, WatchPartySubjects]>;

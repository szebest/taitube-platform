import type { WatchPartyPermission } from '@vp/domain';
import {
  type WatchPartyPermissionMissing,
  type WatchPartyRoleEscalation,
  watchPartyRoleEscalation,
} from '@vp/errors';
import {
  canActOnMember,
  type WatchPartyAbility,
  type WatchPartyMemberSubject,
} from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import { requireRoomPermission } from './permission.rule';

export type MemberAction = 'kick' | 'ban' | 'moderate';

type Target = WatchPartyMemberSubject & { readonly memberKey: string };

const GOVERNING: Readonly<Record<MemberAction, WatchPartyPermission>> = {
  kick: 'members.kick',
  ban: 'members.ban',
  moderate: 'chat.moderate',
};

/** Kicking, banning or removing the chat of a member: never oneself, the owner, or anyone at or above one's own position. */
export function decideMemberAction(input: {
  readonly ability: WatchPartyAbility;
  readonly actorKey: string;
  readonly action: MemberAction;
  readonly target: Target;
}): Result<Target, WatchPartyPermissionMissing | WatchPartyRoleEscalation> {
  const { ability, actorKey, action, target } = input;
  return andThen(requireRoomPermission(ability, GOVERNING[action]), () =>
    target.memberKey !== actorKey && canActOnMember(ability, action, target)
      ? ok(target)
      : err(watchPartyRoleEscalation())
  );
}

/** Ownership moves only from the owner, to a non-guest member other than themselves. */
export function decideOwnerTransfer(input: {
  readonly actorIsOwner: boolean;
  readonly actorKey: string;
  readonly target: Target;
}): Result<Target, WatchPartyRoleEscalation> {
  const { actorIsOwner, actorKey, target } = input;
  return actorIsOwner && target.kind !== 'guest' && target.memberKey !== actorKey
    ? ok(target)
    : err(watchPartyRoleEscalation());
}

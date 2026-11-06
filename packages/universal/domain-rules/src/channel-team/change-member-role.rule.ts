import type { ActingChannel, ChannelMembership, ChannelRole } from '@vp/domain';
import { type UserContext, canChangeChannelMember } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type ChannelMemberNotFound,
  type ChannelOwnerImmutable,
  channelMemberNotFound,
  channelOwnerImmutable,
} from './failures';

export interface ChangeMemberRoleInput {
  readonly user: UserContext;
  readonly acting: ActingChannel;
  readonly userId: string;
  /** The target's membership of the acting channel, as read. */
  readonly member: ChannelMembership | null;
  readonly to: ChannelRole;
}

export interface DecidedRoleChange {
  readonly channelId: string;
  readonly userId: string;
  readonly from: ChannelRole;
  readonly to: ChannelRole;
}

export type ChangeMemberRoleFailure =
  | AuthorizationFailure
  | ChannelOwnerImmutable
  | ChannelMemberNotFound;

const CHANGE = { action: 'update', subject: 'ChannelMember' } as const;

/** Both the role held and the role given must be one the caller may manage. */
export function decideMemberRoleChange({
  user,
  acting,
  userId,
  member,
  to,
}: ChangeMemberRoleInput): Result<DecidedRoleChange, ChangeMemberRoleFailure> {
  const { channelId, ownerId } = acting;
  const may = (role?: ChannelRole) =>
    canChangeChannelMember({ user, member: { channelId, ownerId, userId, ...(role && { role }) } });

  return andThen(
    authorize(user, may(), CHANGE),
    (): Result<DecidedRoleChange, ChangeMemberRoleFailure> => {
      if (userId === ownerId) return err(channelOwnerImmutable());
      if (!member) return err(channelMemberNotFound(userId));
      return andThen(authorize(user, may(member.role) && may(to), CHANGE), () =>
        ok({ channelId, userId, from: member.role, to })
      );
    }
  );
}

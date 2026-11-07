import type { ActingChannel, ChannelMembership, ChannelRole } from '@vp/domain';
import { type UserContext, canRemoveChannelMember } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type ChannelMemberNotFound,
  type ChannelOwnerImmutable,
  channelMemberNotFound,
  channelOwnerImmutable,
} from './failures';

export interface RemoveMemberInput {
  readonly user: UserContext;
  readonly acting: ActingChannel;
  readonly userId: string;
  readonly member: ChannelMembership | null;
}

export interface DecidedRemoval {
  readonly member: {
    readonly channelId: string;
    readonly userId: string;
    readonly role: ChannelRole;
  };
  /** A member removing themselves leaves; anyone else removes them. */
  readonly action: 'member.left' | 'member.removed';
}

export type RemoveMemberFailure =
  | AuthorizationFailure
  | ChannelOwnerImmutable
  | ChannelMemberNotFound;

const REMOVE = { action: 'delete', subject: 'ChannelMember' } as const;

export function decideMemberRemoval({
  user,
  acting,
  userId,
  member,
}: RemoveMemberInput): Result<DecidedRemoval, RemoveMemberFailure> {
  const { channelId, ownerId } = acting;
  const may = (role?: ChannelRole) =>
    canRemoveChannelMember({ user, member: { channelId, ownerId, userId, ...(role && { role }) } });

  return andThen(
    authorize(user, may(), REMOVE),
    (): Result<DecidedRemoval, RemoveMemberFailure> => {
      if (userId === ownerId) return err(channelOwnerImmutable());
      if (!member) return err(channelMemberNotFound(userId));
      const { role } = member;
      return andThen(authorize(user, may(role), REMOVE), () =>
        ok({
          member: { channelId, userId, role },
          action: userId === user.id ? ('member.left' as const) : ('member.removed' as const),
        })
      );
    }
  );
}

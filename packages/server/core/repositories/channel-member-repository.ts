import type {
  ChannelMembership,
  ChannelRole,
  MemberChannel,
  NewChannelAuditEntry,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface ChannelRoleChange {
  channelId: string;
  userId: string;
  from: ChannelRole;
  to: ChannelRole;
}

/** A membership as the caller read it: the role is what a removal is decided against. */
export interface HeldMembership {
  channelId: string;
  userId: string;
  role: ChannelRole;
}

/**
 * A membership is created only by accepting an invite (`ChannelInviteRepositoryPort.accept`). Each
 * change writes its audit entry in the same transaction, so the log never misses one.
 */
export interface ChannelMemberRepositoryPort {
  /** Every channel the user works on, with its owner's user id: the request's role map. */
  membershipsOf(userId: string): Promise<Result<MemberChannel[], DatabaseUnavailable>>;
  /** Oldest first. */
  listByChannel(channelId: string): Promise<Result<ChannelMembership[], DatabaseUnavailable>>;
  /**
   * A compare-and-set on the role the caller decided against: `ok(null)`, and nothing audited,
   * when the user is no member of the channel or no longer holds `from`.
   */
  changeRole(
    change: ChannelRoleChange,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelMembership | null, DatabaseUnavailable>>;
  /** The same compare-and-set on `role`: `false`, and nothing audited, on a miss. */
  remove(
    member: HeldMembership,
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}

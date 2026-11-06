import type {
  ChannelMembership,
  ChannelRole,
  MemberChannel,
  NewChannelAuditEntry,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * A membership is created only by accepting an invite (`ChannelInviteRepositoryPort.accept`). Each
 * change writes its audit entry in the same transaction, so the log never misses one.
 */
export interface ChannelMemberRepositoryPort {
  /** Every channel the user works on, with its owner's user id: the request's role map. */
  membershipsOf(userId: string): Promise<Result<MemberChannel[], DatabaseUnavailable>>;
  /** Oldest first. */
  listByChannel(channelId: string): Promise<Result<ChannelMembership[], DatabaseUnavailable>>;
  /** `ok(null)` when the user is no member of the channel. */
  changeRole(
    channelId: string,
    userId: string,
    role: ChannelRole,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelMembership | null, DatabaseUnavailable>>;
  /** `false` when the user was no member of the channel; then nothing is audited. */
  remove(
    channelId: string,
    userId: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}

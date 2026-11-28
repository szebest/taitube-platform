import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type {
  Channel,
  ChannelStats,
  CreateChannelInput,
  NewChannelAuditEntry,
  UpdateChannelInput,
} from '@vp/domain';
import type { ChannelLimitReached, HandleTaken } from '@vp/errors';

/**
 * A handle collision is a constraint the store reports; whether a missing channel is an error is a
 * domain decision, so every read answers `ok(null)` for an absent row.
 */
export interface ChannelRepositoryPort {
  findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  /** Every channel the user owns, the primary first, then oldest first. */
  listByUserId(userId: string): Promise<Result<Channel[], DatabaseUnavailable>>;
  findPrimaryByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  /** One read for a page of owners; a user with no channel is simply absent from the answer. */
  findPrimaryByUserIds(userIds: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>>;
  /** One read for a page of channels; an id with no channel is simply absent from the answer. */
  findByIds(ids: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>>;
  findByHandle(handle: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  /** What the public feed shows of the channel's videos: the numbers on a channel page. */
  statsOf(channelId: string): Promise<Result<ChannelStats, DatabaseUnavailable>>;
  /**
   * The user's primary channel. A user holds one, so losing a race with a concurrent create for
   * the same user answers `HandleTaken` like a held handle does.
   */
  create(input: CreateChannelInput): Promise<Result<Channel, DatabaseUnavailable | HandleTaken>>;
  /**
   * A further channel, refused once the user owns `limit`; concurrent calls for one user are
   * serialised, so they never pass the limit together. Primary only when the user had none.
   * `audit`, here and on `promote` and `update`, is written with the change and never without it.
   */
  createOwned(
    input: CreateChannelInput,
    limit: number,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel, DatabaseUnavailable | HandleTaken | ChannelLimitReached>>;
  /** Makes the channel the user's one primary; `ok(null)` when the user does not own it. */
  promote(
    userId: string,
    channelId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel | null, DatabaseUnavailable>>;
  update(
    id: string,
    input: UpdateChannelInput,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel | null, DatabaseUnavailable | HandleTaken>>;
}

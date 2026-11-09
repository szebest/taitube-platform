import type { ChannelUserRestriction, NewChannelUserRestriction } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface ChannelUserRestrictionQuery {
  cursor: { createdAt: Date; userId: string } | null;
  limit: number;
  /** A restriction that ended at or before this is absent. */
  now: Date;
}

/** One restriction per user and channel; an expired one reads as absent and is purged later. */
export interface ChannelUserRestrictionRepositoryPort {
  findActive(
    channelId: string,
    userId: string,
    now: Date
  ): Promise<Result<ChannelUserRestriction | null, DatabaseUnavailable>>;
  /** Replaces what the user had on the channel, so a ban over a shadow ban is one row. */
  apply(
    restriction: NewChannelUserRestriction
  ): Promise<Result<ChannelUserRestriction, DatabaseUnavailable>>;
  /** `false` when the user had none to lift. */
  lift(channelId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Newest first, up to `limit + 1` rows. */
  list(
    channelId: string,
    query: ChannelUserRestrictionQuery
  ): Promise<Result<ChannelUserRestriction[], DatabaseUnavailable>>;
  /** Housekeeping: drops every channel's restrictions that ended before `cutoff`; answers how many. */
  purgeEndedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}

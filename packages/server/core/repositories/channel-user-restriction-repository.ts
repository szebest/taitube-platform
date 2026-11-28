import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type {
  ChannelUserRestriction,
  CommentTarget,
  ModerationRecord,
  NewChannelAuditEntry,
  NewChannelUserRestriction,
} from '@vp/domain';

export interface ChannelUserRestrictionQuery {
  cursor: { createdAt: Date; userId: string } | null;
  limit: number;
  /** A restriction that ended at or before this is absent. */
  now: Date;
}

export interface RestrictionWritten {
  restriction: ChannelUserRestriction;
  /** What of the channel the user commented on, whose count was recounted and cache must be purged. */
  targets: CommentTarget[];
}

export interface RestrictionLifted {
  /** `false` when the user had none to lift; nothing was recounted or audited then. */
  lifted: boolean;
  targets: CommentTarget[];
}

/**
 * One restriction per user and channel; an expired one reads as absent and is purged later.
 * `apply` and `lift` recount `comments_count` exactly, over every video of the channel the user
 * commented on, and record `audit`, in the same transaction.
 */
export interface ChannelUserRestrictionRepositoryPort {
  findActive(
    channelId: string,
    userId: string,
    now: Date
  ): Promise<Result<ChannelUserRestriction | null, DatabaseUnavailable>>;
  /** Replaces what the user had on the channel, so a ban over a shadow ban is one row. */
  apply(
    restriction: NewChannelUserRestriction,
    record?: ModerationRecord
  ): Promise<Result<RestrictionWritten, DatabaseUnavailable>>;
  lift(
    channelId: string,
    userId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<RestrictionLifted, DatabaseUnavailable>>;
  /** Newest first, up to `limit + 1` rows. */
  list(
    channelId: string,
    query: ChannelUserRestrictionQuery
  ): Promise<Result<ChannelUserRestriction[], DatabaseUnavailable>>;
  /** Housekeeping: drops every channel's restrictions that ended before `cutoff`; answers how many. */
  purgeEndedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}

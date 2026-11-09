import type {
  CommentRemoval,
  CommentThread,
  ModerationOutcome,
  ModerationState,
  NewChannelAuditEntry,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { CommentLocator } from './comment-repository';

/** A state change of one comment, from the state the decision was made on. */
export interface CommentModerationWrite {
  comment: CommentLocator;
  from: ModerationState;
  /** Never `removed`: a removal is `CommentRepositoryPort.remove`. */
  outcome: ModerationOutcome & { state: ModerationState };
  moderatorId: string;
  audit: NewChannelAuditEntry;
}

export type CommentModerationWritten =
  | {
      type: 'applied';
      thread: CommentThread;
      /** The comment became public for the first time: it was held by the gate and is now approved. */
      firstPublication: boolean;
    }
  | { type: 'stale'; state: ModerationState }
  | { type: 'missing' };

export interface CommentRemovalQuery {
  /** Removals before this are out of the author's list. */
  since: Date;
  cursor: { createdAt: Date; id: string } | null;
  limit: number;
}

/**
 * `moderate` compares and sets on `moderation_state` under the video's lock, moves
 * `videos.comments_count` by the exact change in what is public (the comment and its public
 * replies), unpins what it takes out of public reads, and records its audit row, in one
 * transaction. The first publication of a held comment also enqueues the comment notification and
 * tells the owner, once, because its job id is the comment's.
 */
export interface CommentModerationRepositoryPort {
  moderate(
    write: CommentModerationWrite
  ): Promise<Result<CommentModerationWritten, DatabaseUnavailable>>;
  /** The ids of a live comment and its live replies, for what refers to them elsewhere. */
  threadIds(comment: CommentLocator): Promise<Result<string[], DatabaseUnavailable>>;
  /** The ids of the live comments `authorId` wrote under the videos `videoOwnerId` owns. */
  idsByAuthor(
    authorId: string,
    videoOwnerId: string
  ): Promise<Result<string[], DatabaseUnavailable>>;
  /** The author's visibly removed comments, newest first, up to `limit + 1` rows; silent ones are never listed. */
  listRemovals(
    authorId: string,
    query: CommentRemovalQuery
  ): Promise<Result<CommentRemoval[], DatabaseUnavailable>>;
  /** Housekeeping: drops every removal made before `cutoff`; answers how many. */
  purgeRemovalsBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}

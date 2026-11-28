import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type {
  ModerationOutcome,
  ModerationState,
  NewChannelAuditEntry,
  NewCommentRemoval,
  NewVideoThreadInput,
  ModerationNotice,
  ThreadCreated,
  ThreadPinOutcome,
  VideoThread,
  VideoThreadEntry,
} from '@vp/domain';
import type { CommentReplyCursor, CommentViewer } from './comment-repository';

export interface ListVideoThreadsOptions {
  /** Who reads: their own held threads are listed with the public ones. */
  viewer: CommentViewer;
  limit: number;
}

export interface ListHeldThreadsOptions {
  channelId: string;
  /** Only this author's threads, as the inbox filters comments. */
  authorId?: string;
  cursor: CommentReplyCursor | null;
  limit: number;
}

/** A state change of one thread, from the state the decision was made on; never `removed`. */
export interface ThreadModerationWrite {
  id: string;
  from: ModerationState;
  outcome: ModerationOutcome & { state: ModerationState };
  audit: NewChannelAuditEntry;
  /** Enqueued with the audit row when the author is to be told. */
  notice?: ModerationNotice;
}

export type ThreadModerated =
  | { type: 'applied'; thread: VideoThread }
  | { type: 'stale'; state: ModerationState }
  | { type: 'missing' };

/** What a thread's removal leaves behind: the audit row and, when told to the author, the removal. */
export interface ThreadRemovalRecord {
  audit: NewChannelAuditEntry;
  removal?: NewCommentRemoval;
  notice?: ModerationNotice;
}

/**
 * A video's viewer threads. Listings return the threads the viewer may see, pinned first and then
 * by anchor. `create` counts the author's threads on the video under a lock on the video row, so
 * two requests cannot both take the last slot. A held thread tells the moderators named on the input, as a held comment does. `remove` takes the thread's comments with it.
 */
export interface VideoThreadRepositoryPort {
  findById(id: string): Promise<Result<VideoThread | null, DatabaseUnavailable>>;
  /** The thread with its author and reply counts, in any moderation state. */
  findEntry(id: string): Promise<Result<VideoThreadEntry | null, DatabaseUnavailable>>;
  listByVideo(
    videoId: string,
    options: ListVideoThreadsOptions
  ): Promise<Result<VideoThreadEntry[], DatabaseUnavailable>>;
  /** The channel's held threads, newest first, up to `limit` rows, for the creator inbox. */
  listHeld(
    options: ListHeldThreadsOptions
  ): Promise<Result<VideoThreadEntry[], DatabaseUnavailable>>;
  /** Compares and sets the state, unpins a thread that leaves public reads, and records the audit row. */
  moderate(write: ThreadModerationWrite): Promise<Result<ThreadModerated, DatabaseUnavailable>>;
  /** The author's threads on the video that are still there, held ones too. */
  countOpen(videoId: string, authorId: string): Promise<Result<number, DatabaseUnavailable>>;
  create(
    input: NewVideoThreadInput,
    openLimit: number
  ): Promise<Result<ThreadCreated, DatabaseUnavailable>>;
  /** Pins up to `limit` threads on the video, counted in the same transaction. */
  setPinned(
    id: string,
    pinned: boolean,
    limit: number,
    audit: NewChannelAuditEntry
  ): Promise<Result<ThreadPinOutcome, DatabaseUnavailable>>;
  /** False when the thread was already gone. */
  remove(id: string, record: ThreadRemovalRecord): Promise<Result<boolean, DatabaseUnavailable>>;
}

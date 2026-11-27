import type { Result } from '@kit/result';
import type {
  NewChannelAuditEntry,
  NewCommentRemoval,
  NewVideoThreadInput,
  ModerationNotice,
  ThreadCreated,
  ThreadPinOutcome,
  VideoThread,
  VideoThreadEntry,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { CommentViewer } from './comment-repository';

export interface ListVideoThreadsOptions {
  /** Who reads: their own held threads are listed with the public ones. */
  viewer: CommentViewer;
  limit: number;
}

/** What a thread's removal leaves behind: the audit row and, when told to the author, the removal. */
export interface ThreadRemovalRecord {
  audit: NewChannelAuditEntry;
  removal?: NewCommentRemoval;
  notice?: ModerationNotice;
}

/**
 * A video's viewer threads. Listings return the threads the viewer may see, pinned first and then
 * by anchor. `create` counts the author's threads on the video under a lock on the video row, so
 * two requests cannot both take the last slot. `remove` takes the thread's comments with it.
 */
export interface VideoThreadRepositoryPort {
  findById(id: string): Promise<Result<VideoThread | null, DatabaseUnavailable>>;
  /** The thread with its author and reply counts, in any moderation state. */
  findEntry(id: string): Promise<Result<VideoThreadEntry | null, DatabaseUnavailable>>;
  listByVideo(
    videoId: string,
    options: ListVideoThreadsOptions
  ): Promise<Result<VideoThreadEntry[], DatabaseUnavailable>>;
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

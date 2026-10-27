import type {
  CommentReport,
  CommentReportQueueItem,
  CommentReportResolution,
  NewCommentReportInput,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/** Open reports sort before resolved ones, each group newest first. */
export interface CommentReportQueueCursor {
  open: boolean;
  createdAt: Date;
  id: string;
}

export interface ListCommentReportsOptions {
  cursor: CommentReportQueueCursor | null;
  limit: number;
}

/** A listing returns up to `limit + 1` rows so the caller can tell a further page exists. */
export interface CommentReportRepositoryPort {
  /** Answers null, and writes nothing, when this reporter already reported the comment. */
  create(input: NewCommentReportInput): Promise<Result<CommentReport | null, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<CommentReport | null, DatabaseUnavailable>>;
  list(
    options: ListCommentReportsOptions
  ): Promise<Result<CommentReportQueueItem[], DatabaseUnavailable>>;
  /** Closes every open report on the comment and answers the reports it closed. */
  resolveForComment(
    commentId: string,
    resolution: CommentReportResolution
  ): Promise<Result<CommentReport[], DatabaseUnavailable>>;
  /** Answers null when the report is absent or already resolved. */
  resolve(
    id: string,
    resolution: CommentReportResolution
  ): Promise<Result<CommentReport | null, DatabaseUnavailable>>;
}

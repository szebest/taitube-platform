export const COMMENT_REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'misinformation',
  'other',
] as const;

export type CommentReportReason = (typeof COMMENT_REPORT_REASONS)[number];

export const COMMENT_REPORT_RESOLUTIONS = ['removed', 'dismissed'] as const;

export type CommentReportResolution = (typeof COMMENT_REPORT_RESOLUTIONS)[number];

export interface CommentReport {
  id: string;
  commentId: string;
  reporterId: string;
  reason: CommentReportReason;
  note: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolution: CommentReportResolution | null;
}

export type NewCommentReportInput = Pick<
  CommentReport,
  'id' | 'commentId' | 'reporterId' | 'reason' | 'note'
>;

/** A report with the comment it is about; `removed` once the comment is gone. */
export interface CommentReportQueueItem extends CommentReport {
  comment: {
    id: string;
    videoId: string;
    authorId: string;
    content: string;
    removed: boolean;
  };
}

import type { CommentReportQueueItemView, CommentReportView } from '@vp/api-contracts';
import type { CommentReport, CommentReportQueueItem } from '@vp/domain';

export function toCommentReportView({
  createdAt,
  resolvedAt,
  ...report
}: CommentReport): CommentReportView {
  return {
    ...report,
    createdAt: createdAt.toISOString(),
    resolvedAt: resolvedAt?.toISOString() ?? null,
  };
}

export function toCommentReportQueueItemView({
  comment,
  ...report
}: CommentReportQueueItem): CommentReportQueueItemView {
  return { ...toCommentReportView(report), reporterId: report.reporterId, comment };
}

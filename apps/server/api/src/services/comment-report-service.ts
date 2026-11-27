import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, err, isErr, map, ok } from '@kit/result';
import type { CommentReportQueueItemView, CommentReportView } from '@vp/api-contracts';
import type { CommentReportRepositoryPort } from '@vp/core/repositories';
import type { CommentReportReason, CommentReportResolution } from '@vp/domain';
import {
  type AuthorizationFailure,
  type CommentAlreadyReported,
  type CommentNotFound,
  type PublicHostReadFailure,
  type ReportCommentFailure,
  type ResolveReportFailure,
  commentAlreadyReported,
  decideAdminAccess,
  decideCommentReport,
  decideCommentHostRead,
  decideReportResolve,
  publicHostReadFailure,
  reportAlreadyResolved,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { type CommentLookupDeps, commentWithHost } from './comment-lookup';
import { toCommentReportQueueItemView, toCommentReportView } from './comment-report-views';
import type { CommentService, DeleteCommentServiceFailure } from './comment-service';
import { commentReportCursorPayload, decodeCommentReportCursor } from './cursor';

export interface CommentReportServiceDeps extends CommentLookupDeps {
  reports: CommentReportRepositoryPort;
  commentService: CommentService;
  paginator: Paginator;
}

export type ReportCommentServiceFailure =
  | ReportCommentFailure
  | PublicHostReadFailure
  | CommentAlreadyReported
  | DatabaseUnavailable;

export type ListReportsServiceFailure = AuthorizationFailure | InvalidCursor | DatabaseUnavailable;

export type ResolveReportServiceFailure =
  | ResolveReportFailure
  | Exclude<DeleteCommentServiceFailure, CommentNotFound>
  | DatabaseUnavailable;

export class CommentReportService {
  constructor(private readonly deps: CommentReportServiceDeps) {}

  async report(
    reporter: UserContext,
    commentId: string,
    body: { reason: CommentReportReason; note?: string }
  ): Promise<Result<CommentReportView, ReportCommentServiceFailure>> {
    const found = await commentWithHost(this.deps, commentId);
    if (isErr(found)) return found;
    const { comment, host } = found.value;

    if (host) {
      const readable = decideCommentHostRead(reporter, host);
      if (isErr(readable)) return err(publicHostReadFailure(readable.error));
    }

    const decided = decideCommentReport({
      reporter,
      comment,
      commentId,
      host,
      reason: body.reason,
      note: body.note,
    });
    if (isErr(decided)) return decided;

    const created = await this.deps.reports.create({
      id: uuidv7(),
      commentId,
      reporterId: reporter.id,
      reason: decided.value.reason,
      note: decided.value.note,
    });
    if (isErr(created)) return created;
    return created.value
      ? ok(toCommentReportView(created.value))
      : err(commentAlreadyReported(commentId));
  }

  async list(
    actor: UserContext,
    options: { cursor?: string; limit?: number }
  ): Promise<
    Result<
      { items: CommentReportQueueItemView[]; nextCursor: string | null },
      ListReportsServiceFailure
    >
  > {
    const admin = decideAdminAccess(actor);
    if (isErr(admin)) return admin;

    const { paginator } = this.deps;
    const limit = paginator.limit(options.limit);
    const cursor = decodeCommentReportCursor(options.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.reports.list({ cursor: cursor.value, limit });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: commentReportCursorPayload,
        toItem: toCommentReportQueueItemView,
      })
    );
  }

  /** Removing goes through the comment service's delete, so the counter and the hot cache move with it. */
  async resolve(
    actor: UserContext,
    reportId: string,
    resolution: CommentReportResolution
  ): Promise<Result<CommentReportView, ResolveReportServiceFailure>> {
    const found = await this.deps.reports.findById(reportId);
    if (isErr(found)) return found;

    const decided = decideReportResolve({ actor, report: found.value, reportId });
    if (isErr(decided)) return decided;
    const report = decided.value;

    if (resolution === 'dismissed') {
      const dismissed = await this.deps.reports.resolve(report.id, resolution);
      if (isErr(dismissed)) return dismissed;
      return dismissed.value
        ? ok(toCommentReportView(dismissed.value))
        : err(reportAlreadyResolved(report.id));
    }

    const removed = await this.deps.commentService.remove(actor, report.commentId);
    if (isErr(removed)) {
      const failure = removed.error;
      if (failure.code !== ErrorCodes.COMMENT_NOT_FOUND) return err(failure);
    }

    const closed = await this.deps.reports.resolveForComment(report.commentId, resolution);
    if (isErr(closed)) return closed;

    const resolved = closed.value.find(({ id }) => id === report.id);
    return resolved ? ok(toCommentReportView(resolved)) : err(reportAlreadyResolved(report.id));
  }
}

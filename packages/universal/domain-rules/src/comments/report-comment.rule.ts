import { type Result, andThen, map } from '@kit/result';
import type { Comment, CommentHost, CommentReportReason } from '@vp/domain';
import { type UserContext, canReportComment } from '@vp/permissions';
import { type InvalidReportNote, validateReportNote } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ReadCommentHostFailure, decideCommentHostRead } from './comment-host';
import type { CommentNotFound } from './failures';
import { locateComment } from './located-comment';

export interface ReportCommentInput {
  readonly reporter: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly host: CommentHost | null;
  readonly reason: CommentReportReason;
  readonly note: string | undefined;
}

export interface CommentToReport {
  readonly comment: Comment;
  readonly reason: CommentReportReason;
  readonly note: string | null;
}

export type ReportCommentFailure =
  | AuthorizationFailure
  | CommentNotFound
  | ReadCommentHostFailure
  | InvalidReportNote;

/** A viewer reports what they can see: a comment under something they may not read is not there. */
export function decideCommentReport(
  input: ReportCommentInput
): Result<CommentToReport, ReportCommentFailure> {
  return andThen(
    authorize(input.reporter, canReportComment({ user: input.reporter }), {
      action: 'report',
      subject: 'Comment',
    }),
    (reporter): Result<CommentToReport, ReportCommentFailure> =>
      andThen(locateComment(input), ({ comment, host }) =>
        andThen(decideCommentHostRead(reporter, host), () =>
          map(validateReportNote(input.note), (note) => ({
            comment,
            reason: input.reason,
            note,
          }))
        )
      )
  );
}
